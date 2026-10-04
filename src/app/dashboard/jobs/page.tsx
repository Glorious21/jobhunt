'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api, useAppData } from '@/components/AppData'
import { SidePanel } from '@/components/Dialog'
import StatusChip from '@/components/StatusBadge'
import { useToast } from '@/components/Toast'
import { SOURCE_LABEL } from '@/lib/constants'
import type { Application, JobListing } from '@/lib/types'

interface SearchResponse {
  jobs: JobListing[]
  page: number
  hasMore: boolean
  isSample: boolean
}

const POSTED = [
  { value: 'all', label: 'Any time' },
  { value: 'today', label: 'Past 24 hours' },
  { value: 'week', label: 'Past week' },
]

function postedLabel(iso?: string) {
  if (!iso) return ''
  const hours = Math.max(0, (Date.now() - new Date(iso).getTime()) / 3_600_000)
  if (hours < 1) return 'Just now'
  if (hours < 24) return `${Math.round(hours)} hour${Math.round(hours) === 1 ? '' : 's'} ago`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`
  const weeks = Math.round(days / 7)
  return `${weeks} week${weeks === 1 ? '' : 's'} ago`
}

/** Splits a posting into prose and bullet lines ("- ", "• ", "* "). */
function splitDescription(text = '') {
  const lines = text.split(/\r?\n/)
  const bullets = lines.filter((l) => /^\s*([-•*]|\d+[.)])\s+/.test(l)).map((l) => l.replace(/^\s*([-•*]|\d+[.)])\s+/, '').trim())
  const prose = lines
    .filter((l) => !/^\s*([-•*]|\d+[.)])\s+/.test(l) && !/^\s*what you('|’)ll do\s*:?\s*$/i.test(l))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return { prose, bullets }
}

export default function JobsPage() {
  const { applications, profile, loading: dataLoading, createApplication, updateApplication, deleteApplication, openEditor, takeGoalFlag } = useAppData()
  const { toast } = useToast()
  const [query, setQuery] = useState(profile?.targetRole ?? '')
  const [location, setLocation] = useState(profile?.targetLocation ?? '')
  const [posted, setPosted] = useState('all')
  const [jobType, setJobType] = useState('')
  const [remote, setRemote] = useState(false)
  const [jobs, setJobs] = useState<JobListing[]>([])
  const [meta, setMeta] = useState<Omit<SearchResponse, 'jobs'> | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [openJob, setOpenJob] = useState<JobListing | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const trackedFor = useCallback(
    (j: JobListing): Application | undefined =>
      applications.find((a) => (j.url && a.jobUrl === j.url) || (a.company.toLowerCase() === j.company.toLowerCase() && a.jobTitle.toLowerCase() === j.title.toLowerCase())) ??
      applications.find((a) => a.company.toLowerCase() === j.company.toLowerCase() && a.status !== 'REJECTED'),
    [applications]
  )

  const search = useCallback(
    async (page = 1, over?: Partial<{ query: string; location: string; posted: string; jobType: string; remote: boolean }>) => {
      const q = (over?.query ?? query).trim() || 'designer'
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams({
          query: q,
          location: over?.location ?? location,
          remote: String(over?.remote ?? remote),
          jobType: over?.jobType ?? jobType,
          datePosted: over?.posted ?? posted,
          page: String(page),
        })
        const data = await api<SearchResponse>(`/api/jobs/search?${params}`)
        setJobs((prev) => (page === 1 ? data.jobs : [...prev, ...data.jobs.filter((j) => !prev.some((p) => p.id === j.id))]))
        setMeta({ page: data.page, hasMore: data.hasMore, isSample: data.isSample })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Search failed')
      } finally {
        setLoading(false)
      }
    },
    [query, location, remote, jobType, posted]
  )

  // Run the target-role search once on arrival, like the design's pre-filled results.
  const ran = useRef(false)
  useEffect(() => {
    if (ran.current || dataLoading) return
    ran.current = true
    const role = profile?.targetRole ?? ''
    setQuery(role)
    setLocation(profile?.targetLocation ?? '')
    search(1, { query: role, location: profile?.targetLocation ?? '' })
  }, [search, dataLoading, profile])

  const track = async (job: JobListing, status: 'SAVED' | 'APPLIED') => {
    setBusy(job.id + status)
    const existing = trackedFor(job)
    if (existing && existing.status === 'SAVED' && status === 'APPLIED') {
      if ((await updateApplication(existing.id, { status: 'APPLIED' })) && !takeGoalFlag()) toast(`Tracking ${job.company}`)
    } else if (!existing) {
      const created = await createApplication({
        jobTitle: job.title,
        company: job.company,
        location: job.location,
        salary: job.salary ?? null,
        jobUrl: job.url || null,
        description: job.description ?? null,
        jobType: job.jobType ?? null,
        remote: job.remote,
        source: job.source,
        status,
      })
      if (created && !takeGoalFlag()) toast(status === 'APPLIED' ? `Tracking ${job.company}` : `Saved ${job.title}`)
    }
    setBusy(null)
  }

  const unsave = async (app: Application) => {
    setBusy(app.id)
    if (await deleteApplication(app.id)) toast('Removed from saved')
    setBusy(null)
  }

  const count = jobs.length
  const panelJob = openJob
  const panelTracked = panelJob ? trackedFor(panelJob) : undefined
  const panelParts = useMemo(() => splitDescription(panelJob?.description), [panelJob])

  return (
    <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <form
        className="card"
        style={{ padding: 14, gap: 12 }}
        onSubmit={(e) => {
          e.preventDefault()
          search(1)
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2fr) minmax(0,1fr) auto', gap: 10 }} className="jobs-search-row">
          <input className="input input-lg" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Keyword, title or company" aria-label="Keyword, title or company" />
          <input className="input input-lg" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location" aria-label="Location" />
          <button className="btn btn-primary btn-md" style={{ padding: '0 22px' }} type="submit" disabled={loading}>
            {loading ? 'Searching…' : 'Search'}
          </button>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <select
            className="select"
            style={{ height: 34, width: 'auto', borderRadius: 8 }}
            value={posted}
            aria-label="Date posted"
            onChange={(e) => {
              setPosted(e.target.value)
              search(1, { posted: e.target.value })
            }}
          >
            {POSTED.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
          <select
            className="select"
            style={{ height: 34, width: 'auto', borderRadius: 8 }}
            value={jobType}
            aria-label="Job type"
            onChange={(e) => {
              setJobType(e.target.value)
              search(1, { jobType: e.target.value })
            }}
          >
            <option value="">Any type</option>
            <option value="Full-time">Full-time</option>
            <option value="Contract">Contract</option>
          </select>
          <button
            type="button"
            className="toggle-sq"
            aria-pressed={remote}
            onClick={() => {
              setRemote(!remote)
              search(1, { remote: !remote })
            }}
          >
            Remote only
          </button>
          <span className="muted" style={{ marginLeft: 'auto', fontSize: 13 }}>
            {meta ? `${count} ${meta.isSample ? 'sample ' : ''}result${count === 1 ? '' : 's'}` : ''}
          </span>
        </div>
      </form>

      {meta?.isSample && (
        <span className="faint" style={{ fontSize: 12, marginTop: -6 }}>
          Showing sample listings. Add RAPIDAPI_KEY or Adzuna keys to .env for live jobs.
        </span>
      )}
      {error && (
        <span className="form-error" role="alert">
          {error}
        </span>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {loading && !jobs.length && [0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 88 }} />)}
        {!loading && meta && !jobs.length && <div className="card empty">No jobs match. Try a broader keyword or remove a filter.</div>}
        {jobs.map((j) => {
          const t = trackedFor(j)
          const saved = t?.status === 'SAVED'
          return (
            <div
              key={j.id}
              className="card hover-lift job-card"
              role="button"
              tabIndex={0}
              onClick={() => setOpenJob(j)}
              onKeyDown={(e) => e.key === 'Enter' && e.target === e.currentTarget && setOpenJob(j)}
              style={{ padding: '18px 20px', display: 'grid', gridTemplateColumns: '44px minmax(0,1fr) auto', gap: 16, alignItems: 'center' }}
            >
              <div className="display" style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--line-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'var(--forest)', overflow: 'hidden' }}>
                {j.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={j.logo} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#fff' }} />
                ) : (
                  j.company[0]?.toUpperCase()
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                <span className="truncate" style={{ fontWeight: 600, fontSize: 15 }}>
                  {j.title}
                </span>
                <span className="muted truncate">
                  {j.company} · {j.location}
                </span>
                <span className="faint" style={{ display: 'flex', gap: 14, fontSize: 12, marginTop: 2, flexWrap: 'wrap' }}>
                  {j.salary && <span className="ink-2" style={{ fontWeight: 500 }}>{j.salary}</span>}
                  {j.jobType && <span>{j.jobType}</span>}
                  <span>{SOURCE_LABEL[j.source]}</span>
                  {j.postedAt && <span>{postedLabel(j.postedAt)}</span>}
                </span>
              </div>
              <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {t && !saved ? (
                  <StatusChip status={t.status} size="md" />
                ) : (
                  <>
                    <button
                      className="btn btn-outline"
                      style={{ height: 36, padding: '0 14px', borderRadius: 9, background: saved ? 'var(--lime-tint)' : undefined }}
                      onClick={() => (saved ? unsave(t!) : track(j, 'SAVED'))}
                      disabled={!!busy}
                      aria-pressed={saved}
                    >
                      {saved ? 'Saved' : 'Save'}
                    </button>
                    <button className="btn btn-primary" style={{ height: 36, padding: '0 14px', borderRadius: 9 }} onClick={() => track(j, 'APPLIED')} disabled={!!busy}>
                      Applied
                    </button>
                  </>
                )}
              </div>
            </div>
          )
        })}
        {meta?.hasMore && (
          <button className="btn btn-outline" style={{ alignSelf: 'center' }} onClick={() => search((meta?.page ?? 1) + 1)} disabled={loading}>
            {loading ? 'Loading…' : 'Load more'}
          </button>
        )}
      </div>

      {panelJob && (
        <SidePanel
          title={panelJob.title}
          onClose={() => setOpenJob(null)}
          primaryLabel={panelTracked && panelTracked.status !== 'SAVED' ? 'Open application' : 'Track this job'}
          busy={!!busy}
          onPrimary={async () => {
            if (panelTracked && panelTracked.status !== 'SAVED') {
              setOpenJob(null)
              openEditor({ app: panelTracked })
              return
            }
            await track(panelJob, 'APPLIED')
            setOpenJob(null)
          }}
          footerStart={
            panelJob.url ? (
              <a className="btn btn-outline" href={panelJob.url} target="_blank" rel="noreferrer">
                View posting
              </a>
            ) : undefined
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span className="muted">
                {panelJob.company} · {panelJob.location}
              </span>
              <span className="faint" style={{ display: 'flex', gap: 14, fontSize: 13, flexWrap: 'wrap' }}>
                {panelJob.salary && <span className="ink-2" style={{ fontWeight: 500 }}>{panelJob.salary}</span>}
                {panelJob.jobType && <span>{panelJob.jobType}</span>}
                <span>{SOURCE_LABEL[panelJob.source]}</span>
                {panelJob.postedAt && <span>{postedLabel(panelJob.postedAt)}</span>}
              </span>
            </div>
            <span style={{ fontWeight: 600 }}>About the role</span>
            <span className="ink-2" style={{ lineHeight: 1.6, whiteSpace: 'pre-line' }}>
              {panelParts.prose || 'No description provided. Open the posting for details.'}
            </span>
            {panelParts.bullets.length > 0 && (
              <>
                <span style={{ fontWeight: 600 }}>What you&apos;ll do</span>
                {panelParts.bullets.map((b, i) => (
                  <span key={i} className="ink-2" style={{ display: 'flex', gap: 10, lineHeight: 1.5 }}>
                    <span style={{ flex: 'none', width: 6, height: 6, marginTop: 8, borderRadius: 2, background: 'var(--forest)' }} />
                    {b}
                  </span>
                ))}
              </>
            )}
          </div>
        </SidePanel>
      )}
    </div>
  )
}
