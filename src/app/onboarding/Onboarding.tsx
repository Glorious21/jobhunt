'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Logo } from '@/components/Logo'
import { baseName, CV_ACCEPT, readCvFile, uploadDocumentFile } from '@/lib/read-cv-file'

const PACES = [
  { name: 'Steady', desc: '3 a day · stretch 5', min: 3, stretch: 5 },
  { name: 'Focused', desc: '5 a day · stretch 8', min: 5, stretch: 8 },
  { name: 'Full-time', desc: '10 a day · stretch 15', min: 10, stretch: 15 },
]

export default function Onboarding({ name: initialName }: { name: string }) {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [name, setName] = useState(initialName)
  const [role, setRole] = useState('')
  const [location, setLocation] = useState('')
  const [pace, setPace] = useState('Focused')
  const [min, setMin] = useState(5)
  const [stretch, setStretch] = useState(8)
  const [cvMode, setCvMode] = useState<'upload' | 'paste'>('upload')
  const [cvText, setCvText] = useState('')
  const [cvName, setCvName] = useState('')
  const [cvFile, setCvFile] = useState<File | null>(null)
  const [reading, setReading] = useState(false)
  const [over, setOver] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const onFile = async (file: File) => {
    setError(null)
    setReading(true)
    try {
      setCvText(await readCvFile(file))
      setCvName(baseName(file.name))
      setCvFile(file)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Couldn’t read that file')
    } finally {
      setReading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const finish = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, targetRole: role, targetLocation: location, dailyMin: min, dailyMax: stretch, cvText, cvFileName: cvName || undefined }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not save your setup')
      // Best effort: the extension uses the original file; the setup is already saved.
      if (data.documentId && cvFile && cvMode === 'upload') await uploadDocumentFile(data.documentId, cvFile).catch(() => {})
      router.replace('/dashboard')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your setup')
      setSaving(false)
    }
  }

  const back = () => (step > 1 ? setStep(step - 1) : router.push('/'))
  const next = () => (step < 3 ? setStep(step + 1) : finish())

  return (
    <div className="onboard page-enter">
      <div className="onboard-inner">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Logo size={24} />
          <span className="mono muted" style={{ fontSize: 12 }}>
            Step {step} of 3
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }} aria-hidden>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{ height: 4, borderRadius: 2, background: i <= step ? 'var(--forest)' : '#dfe3dc', transition: 'background-color .4s' }} />
          ))}
        </div>

        <div className="onboard-card">
          {step === 1 && (
            <div key="s1" className="step-enter" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <h1 className="onboard-h1">What are you looking for?</h1>
                <span className="muted">We use this to suggest jobs and check your CV.</span>
              </div>
              <label className="field">
                Your full name
                <input className="input input-xl" value={name} onChange={(e) => setName(e.target.value)} placeholder="Alex Morgan" autoComplete="name" autoFocus />
              </label>
              <label className="field">
                Target role
                <input className="input input-xl" value={role} onChange={(e) => setRole(e.target.value)} placeholder="Product Designer" />
              </label>
              <label className="field">
                Location
                <input className="input input-xl" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Remote · Europe" />
              </label>
            </div>
          )}

          {step === 2 && (
            <div key="s2" className="step-enter" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <h1 className="onboard-h1">Set your daily pace</h1>
                <span className="muted">A minimum keeps your streak alive. A stretch goal is for good days.</span>
              </div>
              <div className="pace-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                {PACES.map((p) => (
                  <button
                    key={p.name}
                    className="pace-card"
                    aria-pressed={pace === p.name}
                    onClick={() => {
                      setPace(p.name)
                      setMin(p.min)
                      setStretch(p.stretch)
                    }}
                  >
                    <span style={{ fontWeight: 600, fontSize: 15 }}>{p.name}</span>
                    <span className="muted" style={{ fontSize: 13 }}>
                      {p.desc}
                    </span>
                  </button>
                ))}
              </div>
              <div className="stepper-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Stepper
                  label="Minimum / day"
                  value={min}
                  onDown={() => {
                    setMin(Math.max(1, min - 1))
                    setPace('Custom')
                  }}
                  onUp={() => {
                    setMin(min + 1)
                    setStretch(Math.max(stretch, min + 1))
                    setPace('Custom')
                  }}
                />
                <Stepper
                  label="Stretch goal"
                  value={stretch}
                  onDown={() => {
                    setStretch(Math.max(min, stretch - 1))
                    setPace('Custom')
                  }}
                  onUp={() => {
                    setStretch(Math.min(50, stretch + 1))
                    setPace('Custom')
                  }}
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div key="s3" className="step-enter" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <h1 className="onboard-h1">Add your CV</h1>
                <span className="muted">We pull out your skills so you can check them against any posting.</span>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="pill pill-lg" aria-pressed={cvMode === 'upload'} onClick={() => setCvMode('upload')}>
                  Upload file
                </button>
                <button className="pill pill-lg" aria-pressed={cvMode === 'paste'} onClick={() => setCvMode('paste')}>
                  Paste text
                </button>
              </div>
              {cvMode === 'upload' ? (
                <div
                  className="dropzone"
                  style={{ height: 180 }}
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
                  <span style={{ fontWeight: 600 }}>{reading ? 'Reading your CV…' : cvName ? `${cvName} added` : 'Drop your CV here or browse'}</span>
                  <span className="muted" style={{ fontSize: 13 }}>
                    {cvName && !reading ? `${cvText.split(/\s+/).filter(Boolean).length} words extracted · drop another to replace` : 'PDF, Word or .txt'}
                  </span>
                  <input ref={fileRef} type="file" accept={CV_ACCEPT} hidden onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
                </div>
              ) : (
                <textarea
                  className="textarea"
                  style={{ height: 180, padding: 14, borderRadius: 14 }}
                  placeholder="Paste your CV text…"
                  value={cvText}
                  onChange={(e) => setCvText(e.target.value)}
                />
              )}
            </div>
          )}

          {error && (
            <span className="form-error" role="alert">
              {error}
            </span>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, paddingTop: 8, borderTop: '1px solid var(--line-2)' }}>
            <button className="btn btn-outline btn-md" onClick={back} disabled={saving}>
              Back
            </button>
            <button className="btn btn-primary btn-md" style={{ padding: '0 22px' }} onClick={next} disabled={saving || reading}>
              {step < 3 ? 'Continue' : saving ? 'Saving…' : 'Finish setup'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Stepper({ label, value, onDown, onUp }: { label: string; value: number; onDown: () => void; onUp: () => void }) {
  return (
    <div className="inset" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontWeight: 500 }}>{label}</span>
      <div className="stepper">
        <button onClick={onDown} aria-label={`Decrease ${label}`}>
          −
        </button>
        <output aria-live="polite">{value}</output>
        <button onClick={onUp} aria-label={`Increase ${label}`}>
          +
        </button>
      </div>
    </div>
  )
}
