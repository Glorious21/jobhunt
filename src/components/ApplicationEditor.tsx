'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useAppData } from '@/components/AppData'
import { ConfirmDialog, SidePanel } from '@/components/Dialog'
import { useToast } from '@/components/Toast'
import { EDITOR_CHANNELS, SOURCE_LABEL, STATUS_LABEL, STATUSES, type Source, type Status } from '@/lib/constants'
import { inboxTime, toLocalInput } from '@/lib/dates'
import { markPendingApply } from '@/lib/pending-apply'
import type { ParsedJob } from '@/lib/job-post'
import type { Application, ApplicationInput } from '@/lib/types'
import { api } from '@/components/AppData'

interface Props {
  app?: Application
  initial?: ApplicationInput
  /** A job post pasted from outside; it's parsed into the form straight away. */
  post?: string
  onClose: () => void
}

type Tab = 'details' | 'notes' | 'emails'

export default function ApplicationEditor({ app, initial, post: initialPost, onClose }: Props) {
  const { createApplication, updateApplication, deleteApplication, emails, takeGoalFlag } = useAppData()
  const { toast } = useToast()
  const base = app ?? initial ?? {}
  const [tab, setTab] = useState<Tab>('details')
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [draft, setDraft] = useState({
    company: base.company ?? '',
    role: base.jobTitle ?? '',
    status: (base.status ?? 'APPLIED') as Status,
    channel: (base.source ?? 'LINKEDIN') as Source,
    location: base.location ?? '',
    salary: base.salary ?? '',
    notes: base.notes ?? '',
    cover: base.coverLetterUsed ?? '',
    jobUrl: base.jobUrl ?? '',
    description: base.description ?? '',
    interviewAt: toLocalInput(base.interviewAt),
    interviewType: base.interviewType ?? '',
    deadline: toLocalInput(base.deadline, false),
    applyEmail: '',
  })
  const [pasteOpen, setPasteOpen] = useState(false)
  const [post, setPost] = useState(initialPost ?? '')
  const [parsing, setParsing] = useState(false)
  const [parsed, setParsed] = useState<string | null>(null)
  const set = <K extends keyof typeof draft>(k: K) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setDraft((d) => ({ ...d, [k]: e.target.value }))

  const channels = EDITOR_CHANNELS.includes(draft.channel) ? EDITOR_CHANNELS : [...EDITOR_CHANNELS, draft.channel]
  const linked = app ? emails.filter((e) => e.applicationId === app.id) : []
  const showInterview = draft.status === 'INTERVIEW' || Boolean(draft.interviewAt)

  const fillFromPost = useCallback(async (text: string) => {
    setParsing(true)
    setParsed(null)
    try {
      const { job } = await api<{ job: ParsedJob }>('/api/jobs/parse', { method: 'POST', json: { text } })
      setDraft((d) => ({
        ...d,
        company: job.company ?? d.company,
        role: job.jobTitle ?? d.role,
        location: job.location ?? d.location,
        salary: job.salary ?? d.salary,
        jobUrl: job.applyUrl ?? d.jobUrl,
        applyEmail: job.applyEmail ?? '',
        description: job.description,
        deadline: job.deadline ? job.deadline.slice(0, 10) : d.deadline,
        channel: job.source ?? d.channel,
        // Not sent yet: it becomes Applied when you confirm you applied.
        status: 'SAVED',
        notes: job.applyEmail && !d.notes.includes(job.applyEmail) ? `Apply by email: ${job.applyEmail}${d.notes ? `\n${d.notes}` : ''}` : d.notes,
      }))
      const found = [job.company && 'company', job.jobTitle && 'role', job.deadline && 'deadline', (job.applyUrl || job.applyEmail) && 'how to apply'].filter(Boolean)
      setParsed(found.length ? `Filled ${found.join(', ')} from the post. Check the details below.` : 'Couldn’t find much in that post. Fill in the details below.')
      setPasteOpen(false)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Couldn’t read that post', { error: true })
    } finally {
      setParsing(false)
    }
  }, [toast])

  // A post pasted from elsewhere in the dashboard is read as soon as the panel opens.
  const autoFilled = useRef(false)
  useEffect(() => {
    if (!initialPost || autoFilled.current) return
    autoFilled.current = true
    fillFromPost(initialPost)
  }, [initialPost, fillFromPost])

  const applyTarget = draft.jobUrl
    ? /^https?:\/\//i.test(draft.jobUrl) ? draft.jobUrl : `https://${draft.jobUrl}`
    : draft.applyEmail
      ? `mailto:${draft.applyEmail}?subject=${encodeURIComponent(`Application for ${draft.role || 'the role'}${draft.company ? ` at ${draft.company}` : ''}`)}`
      : null

  const save = async (openApply = false) => {
    // Open the tab synchronously so pop-up blockers allow it.
    const win = openApply && applyTarget && !applyTarget.startsWith('mailto:') ? window.open('about:blank', '_blank') : null
    const payload = {
      company: draft.company.trim() || 'Untitled company',
      jobTitle: draft.role.trim() || 'Untitled role',
      status: draft.status,
      source: draft.channel,
      location: draft.location || null,
      salary: draft.salary || null,
      notes: draft.notes || null,
      coverLetterUsed: draft.cover || null,
      jobUrl: /^https?:\/\//i.test(draft.jobUrl) ? draft.jobUrl : draft.jobUrl ? `https://${draft.jobUrl}` : null,
      description: draft.description || null,
      interviewAt: draft.interviewAt ? new Date(draft.interviewAt).toISOString() : null,
      interviewType: draft.interviewType || null,
      deadline: draft.deadline ? new Date(`${draft.deadline}T12:00:00`).toISOString() : null,
    }
    setBusy(true)
    const result = app ? await updateApplication(app.id, payload) : await createApplication({ ...payload, remote: /remote/i.test(draft.location) })
    setBusy(false)
    if (!result) {
      win?.close()
      return
    }
    onClose()
    if (openApply && applyTarget) {
      if (win) win.location.href = applyTarget
      else window.location.href = applyTarget // mailto
      // When you come back, jobhunt asks whether you applied (and counts it toward your streak).
      if (result.status === 'SAVED') markPendingApply({ id: result.id, company: result.company })
      return
    }
    if (!takeGoalFlag()) toast(app ? 'Application saved' : 'Application added')
  }

  const remove = async () => {
    setConfirmDelete(false)
    setBusy(true)
    const ok = await deleteApplication(app!.id)
    setBusy(false)
    if (ok) {
      onClose()
      toast('Application deleted')
    }
  }

  return (
    <>
      <SidePanel
        title={app ? app.company : 'Add application'}
        onClose={confirmDelete ? () => {} : onClose}
        primaryLabel={app ? 'Save changes' : 'Add application'}
        onPrimary={() => save()}
        busy={busy}
        footerStart={
          app ? (
            <button className="btn btn-danger-outline" onClick={() => setConfirmDelete(true)} disabled={busy}>
              Delete
            </button>
          ) : applyTarget && draft.status === 'SAVED' ? (
            <button className="btn btn-outline" onClick={() => save(true)} disabled={busy} title="Saves the job, then opens the application page">
              Save &amp; apply
            </button>
          ) : undefined
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {!app && (
            <div className="inset" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {pasteOpen ? (
                <>
                  <label className="field">
                    Paste a job post
                    <textarea
                      className="textarea"
                      style={{ height: 160 }}
                      value={post}
                      onChange={(e) => setPost(e.target.value)}
                      placeholder="Paste the post from WhatsApp, Telegram, LinkedIn, email or a website…"
                      autoFocus
                    />
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-primary btn-sm" onClick={() => fillFromPost(post)} disabled={parsing || post.trim().length < 20}>
                      {parsing ? 'Reading…' : 'Fill from post'}
                    </button>
                    <button className="btn btn-outline btn-sm" onClick={() => setPasteOpen(false)}>
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <span className="muted" style={{ fontSize: 13, lineHeight: 1.45 }}>
                    {parsing ? 'Reading the job post…' : parsed ?? 'Saw a job post? Paste it and we’ll fill this in.'}
                  </span>
                  <button className="btn btn-outline btn-sm" style={{ flex: 'none' }} onClick={() => setPasteOpen(true)}>
                    {parsed ? 'Paste another' : 'Paste a job post'}
                  </button>
                </div>
              )}
            </div>
          )}
          <div className="tabs" role="tablist">
            {(
              [
                ['details', 'Details'],
                ['notes', 'Notes & cover letter'],
                ['emails', 'Emails'],
              ] as [Tab, string][]
            ).map(([k, label]) => (
              <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>
                {label}
              </button>
            ))}
          </div>

          {tab === 'details' && (
            <>
              <div className="grid-2">
                <label className="field">
                  Company
                  <input className="input" value={draft.company} onChange={set('company')} autoFocus={!app} />
                </label>
                <label className="field">
                  Role
                  <input className="input" value={draft.role} onChange={set('role')} />
                </label>
                <label className="field">
                  Status
                  <select className="select" value={draft.status} onChange={set('status')}>
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABEL[s]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  Channel
                  <select className="select" value={draft.channel} onChange={set('channel')}>
                    {channels.map((c) => (
                      <option key={c} value={c}>
                        {SOURCE_LABEL[c]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  Location
                  <input className="input" value={draft.location} onChange={set('location')} />
                </label>
                <label className="field">
                  Salary
                  <input className="input" value={draft.salary} onChange={set('salary')} />
                </label>
                {(draft.status === 'SAVED' || draft.deadline) && (
                  <label className="field">
                    Deadline
                    <input className="input" type="date" value={draft.deadline} onChange={set('deadline')} />
                  </label>
                )}
                {showInterview && (
                  <>
                    <label className="field">
                      Interview
                      <input className="input" type="datetime-local" value={draft.interviewAt} onChange={set('interviewAt')} />
                    </label>
                    <label className="field">
                      Interview type
                      <input className="input" value={draft.interviewType} onChange={set('interviewType')} placeholder="e.g. Portfolio review" />
                    </label>
                  </>
                )}
              </div>
              <label className="field">
                Job posting link
                <input className="input" value={draft.jobUrl} onChange={set('jobUrl')} placeholder="https://" inputMode="url" />
              </label>
              <label className="field">
                Job description
                <textarea className="textarea" style={{ height: 120 }} value={draft.description} onChange={set('description')} placeholder="Paste the posting to check your CV against it" />
              </label>
            </>
          )}

          {tab === 'notes' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <label className="field">
                Notes
                <textarea className="textarea" style={{ height: 120 }} value={draft.notes} onChange={set('notes')} />
              </label>
              <label className="field">
                Cover letter
                <textarea className="textarea" style={{ height: 200 }} value={draft.cover} onChange={set('cover')} />
              </label>
            </div>
          )}

          {tab === 'emails' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {linked.map((e) => (
                <div key={e.id} style={{ padding: 14, borderRadius: 10, border: '1px solid var(--line-2)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <span style={{ fontWeight: 600 }}>{e.subject || '(no subject)'}</span>
                    <span className="faint" style={{ fontSize: 12, flex: 'none' }}>
                      {inboxTime(e.date)}
                    </span>
                  </span>
                  <span className="muted" style={{ lineHeight: 1.45 }}>
                    {e.snippet}
                  </span>
                </div>
              ))}
              {linked.length === 0 && <span className="muted">No emails linked to this application yet.</span>}
            </div>
          )}
        </div>
      </SidePanel>

      {confirmDelete && app && (
        <ConfirmDialog
          title="Delete application?"
          body={`${app.company} · ${app.jobTitle} will be removed from your pipeline.`}
          onConfirm={remove}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </>
  )
}
