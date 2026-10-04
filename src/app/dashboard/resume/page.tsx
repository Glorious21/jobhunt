'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api, useAppData } from '@/components/AppData'
import { ConfirmDialog, SidePanel } from '@/components/Dialog'
import { useToast } from '@/components/Toast'
import { daysBetween } from '@/lib/dates'
import { baseName, CV_ACCEPT, readCvFile, uploadDocumentFile } from '@/lib/read-cv-file'
import type { TailorResult, UserDocument } from '@/lib/types'

const KIND: Record<string, string> = { cv: 'CV', portfolio: 'Portfolio', cover_letter_template: 'Template' }

function updatedLabel(iso: string) {
  const d = daysBetween(iso)
  if (d <= 0) return 'today'
  if (d === 1) return 'yesterday'
  if (d < 7) return `${d} days ago`
  if (d < 30) return `${Math.round(d / 7)} week${Math.round(d / 7) === 1 ? '' : 's'} ago`
  const m = Math.round(d / 30)
  return `${m} month${m === 1 ? '' : 's'} ago`
}

export default function ResumePage() {
  const { applications, updateApplication } = useAppData()
  const { toast } = useToast()
  const [docs, setDocs] = useState<UserDocument[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [panel, setPanel] = useState<UserDocument | 'new' | null>(null)
  const [deleting, setDeleting] = useState<UserDocument | null>(null)

  const [src, setSrc] = useState<'app' | 'paste'>('app')
  const candidates = useMemo(() => applications.filter((a) => a.status !== 'REJECTED').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [applications])
  const [appId, setAppId] = useState('')
  const [pasted, setPasted] = useState('')
  const [checking, setChecking] = useState(false)
  const [result, setResult] = useState<{ data: TailorResult; appId: string | null } | null>(null)
  const [checkError, setCheckError] = useState<string | null>(null)
  const [extra, setExtra] = useState<'message' | 'tips' | null>(null)

  const load = useCallback(async () => {
    try {
      setDocs((await api<{ documents: UserDocument[] }>('/api/documents')).documents)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load documents')
    }
  }, [])
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  const selectedApp = candidates.find((a) => a.id === appId) ?? candidates[0]
  const cv = docs?.filter((d) => d.type === 'cv').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]

  const runCheck = async () => {
    setCheckError(null)
    setExtra(null)
    if (!cv?.parsedText) {
      setCheckError('Add your CV first, then check it against a job.')
      return
    }
    const app = src === 'app' ? selectedApp : undefined
    const description = src === 'app' ? app?.description ?? '' : pasted
    if (src === 'app' && !app) {
      setCheckError('You have no tracked applications yet. Paste a posting instead.')
      return
    }
    if (description.trim().length < 50) {
      setCheckError(
        src === 'app'
          ? `${app!.company} has no job description saved. Paste it into the application's details, or use "Paste a posting".`
          : 'Paste the full job description so there is something to match against.'
      )
      return
    }
    setChecking(true)
    try {
      const { result } = await api<{ result: TailorResult }>('/api/ai/tailor', {
        method: 'POST',
        json: { jobTitle: app?.jobTitle ?? 'This role', company: app?.company ?? '', jobDescription: description, cvText: cv.parsedText },
      })
      setResult({ data: result, appId: app?.id ?? null })
    } catch (err) {
      setCheckError(err instanceof Error ? err.message : 'Check failed')
    } finally {
      setChecking(false)
    }
  }

  const removeDoc = async (doc: UserDocument) => {
    setDeleting(null)
    try {
      await api(`/api/documents?id=${doc.id}`, { method: 'DELETE' })
      setDocs((d) => d?.filter((x) => x.id !== doc.id) ?? null)
      toast('Document deleted')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Delete failed', { error: true })
    }
  }

  const r = result?.data
  const resultApp = result?.appId ? applications.find((a) => a.id === result.appId) : undefined
  const verdict = !r ? '' : r.matchScore >= 70 ? 'Strong match' : r.matchScore >= 45 ? 'Partial match' : 'Weak match'
  const missingCount = r?.missingSkills.length ?? 0
  const explanation = !r
    ? ''
    : r.matchScore >= 70
      ? missingCount
        ? `You cover most of the required skills. Add the ${missingCount === 1 ? 'missing one' : `${missingCount} missing ones`} if you have the experience.`
        : 'You cover the skills this posting asks for.'
      : r.matchScore >= 45
        ? 'You cover some of the required skills. Address the gaps before you apply.'
        : 'Your CV shows few of the skills this posting asks for. Tailor it, or spend your effort on a closer match.'

  return (
    <div className="page-enter resume-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.4fr)', gap: 16, alignItems: 'start' }}>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="card-title" style={{ whiteSpace: 'nowrap' }}>
            Your documents
          </span>
          <button className="btn btn-outline btn-sm" style={{ flex: 'none' }} onClick={() => setPanel('new')}>
            Add document
          </button>
        </div>
        {loadError && <span className="form-error">{loadError}</span>}
        {!docs && !loadError && <div className="skeleton" style={{ height: 120 }} />}
        {docs?.length === 0 && <span className="muted">No documents yet. Add your CV to check it against jobs.</span>}
        {docs?.map((d) => (
          <div
            key={d.id}
            className="hover-lift"
            role="button"
            tabIndex={0}
            onClick={() => setPanel(d)}
            onKeyDown={(e) => e.key === 'Enter' && e.target === e.currentTarget && setPanel(d)}
            style={{ padding: 14, borderRadius: 12, border: '1px solid var(--line-2)', display: 'flex', flexDirection: 'column', gap: 10 }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                <span className="truncate" style={{ fontWeight: 600 }}>
                  {d.fileName}
                </span>
                <span className="faint" style={{ fontSize: 12 }}>
                  {KIND[d.type] ?? 'Document'} · updated {updatedLabel(d.updatedAt)}
                </span>
              </div>
              <button
                className="doc-delete"
                onClick={(e) => {
                  e.stopPropagation()
                  setDeleting(d)
                }}
              >
                Delete
              </button>
            </div>
            {d.skills.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {d.skills.slice(0, 8).map((s) => (
                  <span key={s} className="tag">
                    {s}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="card" style={{ gap: 16 }}>
        <span className="card-title">Check against a job</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="pill" aria-pressed={src === 'app'} onClick={() => setSrc('app')}>
            Tracked application
          </button>
          <button className="pill" aria-pressed={src === 'paste'} onClick={() => setSrc('paste')}>
            Paste a posting
          </button>
        </div>
        {src === 'app' ? (
          <select className="select" style={{ height: 44, padding: '0 12px' }} value={selectedApp?.id ?? ''} onChange={(e) => setAppId(e.target.value)} aria-label="Tracked application">
            {candidates.length === 0 && <option value="">No tracked applications</option>}
            {candidates.map((a) => (
              <option key={a.id} value={a.id}>
                {a.company} · {a.jobTitle}
              </option>
            ))}
          </select>
        ) : (
          <textarea className="textarea" style={{ height: 120 }} placeholder="Paste the job description…" value={pasted} onChange={(e) => setPasted(e.target.value)} aria-label="Job description" />
        )}
        {checkError && (
          <span className="form-error" role="alert">
            {checkError}
          </span>
        )}
        <button className="btn btn-primary btn-md" onClick={runCheck} disabled={checking}>
          {checking ? 'Checking…' : 'Check match'}
        </button>

        {r && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, paddingTop: 18, borderTop: '1px solid var(--line-2)' }}>
            <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
              <div className="ring" style={{ width: 96, height: 96, ['--p' as string]: r.matchScore }}>
                <div className="display" style={{ width: 74, height: 74, fontWeight: 800, fontSize: 26 }}>
                  {r.matchScore}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontWeight: 600, fontSize: 16 }}>{verdict}</span>
                <span className="muted" style={{ lineHeight: 1.45 }}>
                  {explanation}
                </span>
              </div>
            </div>
            <div className="grid-2" style={{ gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'oklch(0.4 0.1 145)' }}>You have</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {r.matchingSkills.length ? r.matchingSkills.map((s) => <span key={s} className="tag-have">{s}</span>) : <span className="faint">None detected</span>}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--warn-text)' }}>Missing from your CV</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {r.missingSkills.length ? r.missingSkills.map((s) => <span key={s} className="tag-missing">{s}</span>) : <span className="faint">Nothing obvious</span>}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 16, borderRadius: 12, background: 'var(--surface-2)', border: '1px solid var(--line-2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <span style={{ fontWeight: 600 }}>Tailored for this role</span>
                <span className="mono faint" style={{ fontSize: 11 }}>
                  {r.mode === 'ai' ? 'OpenAI key connected' : 'No OpenAI key'}
                </span>
              </div>
              {r.mode === 'ai' ? (
                <>
                  {r.tailoredSummary && (
                    <>
                      <span className="muted" style={{ fontSize: 12, fontWeight: 600 }}>Summary</span>
                      <span className="ink-2" style={{ lineHeight: 1.5 }}>{r.tailoredSummary}</span>
                    </>
                  )}
                  {r.coverLetter && (
                    <>
                      <span className="muted" style={{ fontSize: 12, fontWeight: 600 }}>Cover letter</span>
                      <span className="ink-2" style={{ lineHeight: 1.5, whiteSpace: 'pre-line' }}>{r.coverLetter}</span>
                    </>
                  )}
                  {extra === 'message' && r.inMailPitch && (
                    <>
                      <span className="muted" style={{ fontSize: 12, fontWeight: 600 }}>Recruiter message</span>
                      <span className="ink-2" style={{ lineHeight: 1.5 }}>{r.inMailPitch}</span>
                    </>
                  )}
                  {extra === 'tips' && r.interviewTips?.length ? (
                    <>
                      <span className="muted" style={{ fontSize: 12, fontWeight: 600 }}>Interview tips</span>
                      {r.interviewTips.map((t, i) => (
                        <span key={i} className="ink-2" style={{ lineHeight: 1.5 }}>
                          • {t}
                        </span>
                      ))}
                    </>
                  ) : null}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                    {r.coverLetter && resultApp && (
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={async () => {
                          if (await updateApplication(resultApp.id, { coverLetterUsed: r.coverLetter })) toast(`Cover letter saved to ${resultApp.company}`)
                        }}
                      >
                        Save cover letter to application
                      </button>
                    )}
                    {r.inMailPitch && (
                      <button className="btn btn-outline btn-sm" aria-pressed={extra === 'message'} onClick={() => setExtra(extra === 'message' ? null : 'message')}>
                        Recruiter message
                      </button>
                    )}
                    {r.interviewTips?.length ? (
                      <button className="btn btn-outline btn-sm" aria-pressed={extra === 'tips'} onClick={() => setExtra(extra === 'tips' ? null : 'tips')}>
                        Interview tips
                      </button>
                    ) : null}
                  </div>
                </>
              ) : (
                <span className="muted" style={{ lineHeight: 1.5 }}>
                  Add OPENAI_API_KEY to .env to draft a summary, cover letter, recruiter message and interview tips from your real experience.
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {panel && (
        <DocumentPanel
          doc={panel === 'new' ? undefined : panel}
          onClose={() => setPanel(null)}
          onSaved={(d) => {
            setDocs((prev) => [d, ...(prev ?? []).filter((x) => x.id !== d.id)])
            setPanel(null)
            toast('Document saved')
          }}
        />
      )}
      {deleting && (
        <ConfirmDialog title="Delete document?" body={`"${deleting.fileName}" will be removed.`} onConfirm={() => removeDoc(deleting)} onCancel={() => setDeleting(null)} />
      )}
    </div>
  )
}

function DocumentPanel({ doc, onClose, onSaved }: { doc?: UserDocument; onClose: () => void; onSaved: (d: UserDocument) => void }) {
  const [name, setName] = useState(doc?.fileName ?? '')
  const [type, setType] = useState(doc?.type ?? 'cv')
  const [text, setText] = useState(doc?.parsedText ?? '')
  const [file, setFile] = useState<File | null>(null)
  const [reading, setReading] = useState<string | null>(null)
  const [over, setOver] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const onFile = async (file: File) => {
    setError(null)
    setReading(file.name)
    try {
      setText(await readCvFile(file))
      setFile(file)
      if (!name) setName(baseName(file.name))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Couldn’t read that file')
    } finally {
      setReading(null)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const save = async () => {
    if (text.trim().length < 20) {
      setError('Upload a file or paste the document text first.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const payload = { fileName: name.trim() || 'Untitled document', type, parsedText: text }
      const { document } = doc
        ? await api<{ document: UserDocument }>(`/api/documents?id=${doc.id}`, { method: 'PATCH', json: payload })
        : await api<{ document: UserDocument }>('/api/documents', { method: 'POST', json: payload })
      // Keep the original so the browser extension can attach it to application forms.
      if (file) {
        await uploadDocumentFile(document.id, file)
        document.hasFile = true
      }
      onSaved(document)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
      setSaving(false)
    }
  }

  return (
    <SidePanel title={doc ? 'Edit document' : 'Add document'} onClose={onClose} primaryLabel={saving ? 'Saving…' : 'Save document'} onPrimary={save} busy={saving || !!reading}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <label className="field">
          Name
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus={!doc} />
        </label>
        <label className="field">
          Type
          <select className="select" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="cv">CV</option>
            <option value="portfolio">Portfolio</option>
            <option value="cover_letter_template">Template</option>
          </select>
        </label>
        <div
          className="dropzone"
          style={{ height: 120, borderRadius: 12, gap: 6 }}
          data-over={over}
          role="button"
          tabIndex={0}
          onClick={() => !reading && fileRef.current?.click()}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && fileRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setOver(true)
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setOver(false)
            const f = e.dataTransfer.files[0]
            if (f && !reading) onFile(f)
          }}
        >
          <span style={{ fontWeight: 600 }}>{reading ? `Reading ${reading}…` : file ? `${file.name} ready` : doc?.hasFile ? 'Replace the file' : 'Upload a file'}</span>
          <span className="muted" style={{ fontSize: 12 }}>
            PDF, Word or .txt
          </span>
          <input ref={fileRef} type="file" accept={CV_ACCEPT} hidden onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        </div>
        <label className="field">
          Or paste text
          <textarea className="textarea" style={{ height: 160 }} placeholder="Paste document text…" value={text} onChange={(e) => setText(e.target.value)} />
        </label>
        {error && (
          <span className="form-error" role="alert">
            {error}
          </span>
        )}
      </div>
    </SidePanel>
  )
}
