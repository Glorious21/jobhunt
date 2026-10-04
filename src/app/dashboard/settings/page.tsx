'use client'

import { useCallback, useEffect, useState } from 'react'
import { signIn, signOut } from 'next-auth/react'
import { api, useAppData } from '@/components/AppData'
import { ConfirmDialog, useEscape } from '@/components/Dialog'
import { LoadError, PageSkeleton } from '@/components/PageState'
import { useToast } from '@/components/Toast'
import { setTheme, useTheme, type Theme } from '@/lib/theme'
import { ago } from '@/lib/dates'
import type { Profile } from '@/lib/types'

export default function SettingsPage() {
  const { profile, loading, error, reload } = useAppData()
  if (loading) return <PageSkeleton />
  if (error || !profile) return <LoadError message={error ?? 'Profile missing'} onRetry={reload} />
  return <Settings profile={profile} />
}

function Settings({ profile }: { profile: Profile }) {
  const { updateProfile, gmail, reload } = useAppData()
  const { toast } = useToast()
  const theme = useTheme()
  const [form, setForm] = useState({
    name: profile.name ?? '',
    portfolioUrl: profile.portfolioUrl ?? '',
    targetRole: profile.targetRole ?? '',
    targetLocation: profile.targetLocation ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [dialog, setDialog] = useState<'delete' | 'password' | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)

  const google = profile.providers.includes('google')
  const field = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const save = async () => {
    setSaving(true)
    const ok = await updateProfile(form)
    setSaving(false)
    if (ok) toast('Profile saved')
  }

  const toggleGmail = async () => {
    if (!google) {
      if (!gmail?.available) {
        toast('Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env to connect Gmail', { error: true })
        return
      }
      signIn('google', { callbackUrl: '/dashboard/settings' })
      return
    }
    setDisconnecting(true)
    try {
      await api('/api/accounts/google', { method: 'DELETE' })
      await reload()
      toast('Gmail disconnected')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not disconnect', { error: true })
    } finally {
      setDisconnecting(false)
    }
  }

  const deleteAccount = async () => {
    setDeleting(true)
    try {
      await api('/api/profile', { method: 'DELETE' })
      await signOut({ callbackUrl: '/' })
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not delete account', { error: true })
      setDeleting(false)
      setDialog(null)
    }
  }

  return (
    <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 760 }}>
      <div className="card card-22">
        <span className="card-title">Profile</span>
        <div className="grid-2">
          <label className="field">
            Name
            <input className="input" value={form.name} onChange={field('name')} autoComplete="name" />
          </label>
          <label className="field">
            Portfolio link
            <input className="input" value={form.portfolioUrl} onChange={field('portfolioUrl')} inputMode="url" />
          </label>
          <label className="field">
            Target role
            <input className="input" value={form.targetRole} onChange={field('targetRole')} />
          </label>
          <label className="field">
            Location
            <input className="input" value={form.targetLocation} onChange={field('targetLocation')} />
          </label>
        </div>
        <button className="btn btn-primary" style={{ alignSelf: 'flex-start' }} onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>

      <AutofillCard profile={profile} />

      <ExtensionCard isDemo={profile.isDemo} />

      <div className="card card-22" style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span className="card-title">Theme</span>
          <span className="muted" style={{ fontSize: 13 }}>
            Match your system or pick one.
          </span>
        </div>
        <div className="seg" role="group" aria-label="Theme">
          {(['system', 'light', 'dark'] as Theme[]).map((t) => (
            <button key={t} aria-pressed={theme === t} onClick={() => setTheme(t)}>
              {t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="card card-22" style={{ gap: 6 }}>
        <span className="card-title" style={{ marginBottom: 8 }}>
          Connected accounts
        </span>
        <AccountRow
          title="Google / Gmail"
          detail={google ? `Connected as ${profile.email}` : gmail?.available ? 'Not connected' : 'Not connected · needs Google keys in .env'}
          action={
            <button className="btn btn-outline btn-sm" onClick={toggleGmail} disabled={disconnecting}>
              {google ? (disconnecting ? 'Disconnecting…' : 'Disconnect') : 'Connect'}
            </button>
          }
        />
        <AccountRow
          title="Email & password"
          detail={profile.isDemo ? 'Demo workspace' : profile.email ?? ''}
          action={
            <button className="btn btn-outline btn-sm" onClick={() => setDialog('password')} disabled={profile.isDemo}>
              {profile.hasPassword ? 'Change password' : 'Set password'}
            </button>
          }
        />
        <button className="btn btn-outline" style={{ alignSelf: 'flex-start', marginTop: 10, height: 36, padding: '0 14px', borderRadius: 9 }} onClick={() => signOut({ callbackUrl: '/' })}>
          Sign out
        </button>
      </div>

      <div className="card card-22" style={{ borderColor: 'var(--danger-border)', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span className="card-title" style={{ color: 'var(--danger-text)' }}>
            Delete account
          </span>
          <span className="muted" style={{ fontSize: 13 }}>
            Removes all applications, documents and emails. This can&apos;t be undone.
          </span>
        </div>
        <button className="btn btn-danger" style={{ height: 38, padding: '0 14px', borderRadius: 9, flex: 'none' }} onClick={() => setDialog('delete')}>
          Delete account
        </button>
      </div>

      {dialog === 'delete' && (
        <ConfirmDialog
          title="Delete your account?"
          body='All applications, documents and linked emails will be permanently deleted. Type "delete" to confirm.'
          requireText="delete"
          busy={deleting}
          onConfirm={deleteAccount}
          onCancel={() => setDialog(null)}
        />
      )}
      {dialog === 'password' && <PasswordDialog hasPassword={profile.hasPassword} onClose={() => setDialog(null)} onDone={() => { setDialog(null); reload(); toast('Password updated') }} />}
    </div>
  )
}

function AccountRow({ title, detail, action }: { title: string; detail: string; action: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--line-3)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <span style={{ fontWeight: 500 }}>{title}</span>
        <span className="faint truncate" style={{ fontSize: 12 }}>
          {detail}
        </span>
      </div>
      {action}
    </div>
  )
}

function PasswordDialog({ hasPassword, onClose, onDone }: { hasPassword: boolean; onClose: () => void; onDone: () => void }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEscape(onClose)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api('/api/profile/password', { method: 'POST', json: { current, next } })
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update password')
      setBusy(false)
    }
  }

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <form className="dialog" role="dialog" aria-modal="true" aria-labelledby="pw-title" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2 id="pw-title">{hasPassword ? 'Change password' : 'Set a password'}</h2>
        {hasPassword && (
          <label className="field">
            Current password
            <input className="input" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" autoFocus />
          </label>
        )}
        <label className="field">
          New password
          <input className="input" type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" placeholder="At least 8 characters" autoFocus={!hasPassword} />
        </label>
        {error && (
          <span className="form-error" role="alert">
            {error}
          </span>
        )}
        <div className="dialog-actions">
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy || next.length < 8}>
            {busy ? 'Saving…' : 'Save password'}
          </button>
        </div>
      </form>
    </div>
  )
}

function AutofillCard({ profile }: { profile: Profile }) {
  const { updateProfile } = useAppData()
  const { toast } = useToast()
  const [form, setForm] = useState({ phone: profile.phone ?? '', linkedinUrl: profile.linkedinUrl ?? '', githubUrl: profile.githubUrl ?? '' })
  const [saving, setSaving] = useState(false)
  const field = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }))

  return (
    <div className="card card-22">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span className="card-title">Autofill details</span>
        <span className="muted" style={{ fontSize: 13 }}>
          The browser extension uses these, with your name, email, portfolio and latest CV, to fill application forms.
        </span>
      </div>
      <div className="grid-2">
        <label className="field">
          Phone
          <input className="input" value={form.phone} onChange={field('phone')} autoComplete="tel" inputMode="tel" placeholder="+234 801 234 5678" />
        </label>
        <label className="field">
          LinkedIn
          <input className="input" value={form.linkedinUrl} onChange={field('linkedinUrl')} inputMode="url" placeholder="linkedin.com/in/you" />
        </label>
        <label className="field">
          GitHub
          <input className="input" value={form.githubUrl} onChange={field('githubUrl')} inputMode="url" placeholder="github.com/you" />
        </label>
      </div>
      <button
        className="btn btn-primary"
        style={{ alignSelf: 'flex-start' }}
        disabled={saving}
        onClick={async () => {
          setSaving(true)
          if (await updateProfile(form)) toast('Autofill details saved')
          setSaving(false)
        }}
      >
        {saving ? 'Saving…' : 'Save details'}
      </button>
    </div>
  )
}

interface TokenRow {
  id: string
  name: string
  prefix: string
  lastUsedAt: string | null
  createdAt: string
}

function ExtensionCard({ isDemo }: { isDemo: boolean }) {
  const { toast } = useToast()
  const [tokens, setTokens] = useState<TokenRow[] | null>(null)
  const [fresh, setFresh] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    try {
      setTokens((await api<{ tokens: TokenRow[] }>('/api/tokens')).tokens)
    } catch {
      setTokens([])
    }
  }, [])
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  const create = async () => {
    setBusy(true)
    try {
      const { token, record } = await api<{ token: string; record: TokenRow }>('/api/tokens', { method: 'POST', json: { name: 'Browser extension' } })
      setFresh(token)
      setCopied(false)
      setTokens((t) => [record, ...(t ?? [])])
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not create a token', { error: true })
    } finally {
      setBusy(false)
    }
  }

  const revoke = async (id: string) => {
    try {
      await api(`/api/tokens?id=${id}`, { method: 'DELETE' })
      setTokens((t) => t?.filter((x) => x.id !== id) ?? null)
      toast('Token revoked. The extension using it is signed out.')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not revoke', { error: true })
    }
  }

  const server = typeof window !== 'undefined' ? window.location.origin : ''

  return (
    <div className="card card-22">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span className="card-title">Browser extension</span>
        <span className="muted" style={{ fontSize: 13, lineHeight: 1.5 }}>
          On any job page or application form: track the job, fill the form with your details and CV, and draft a cover letter. You review and click Submit; it then asks to mark the job as applied.
        </span>
      </div>
      <ol className="muted" style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.7 }}>
        <li>
          Open <span className="mono">edge://extensions</span> or <span className="mono">chrome://extensions</span>, turn on Developer mode, choose <b>Load unpacked</b> and pick the <span className="mono">extension</span> folder in this project.
        </li>
        <li>Create a token below and paste it, with the server address, into the extension.</li>
      </ol>

      {fresh && (
        <div className="inset" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontWeight: 600 }}>Your new token. Copy it now; it won’t be shown again.</span>
          <code className="mono" style={{ fontSize: 12, wordBreak: 'break-all', background: 'var(--surface)', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--line)' }}>
            {fresh}
          </code>
          <span className="faint" style={{ fontSize: 12 }}>
            Server: <span className="mono">{server}</span>
          </span>
          <button
            className="btn btn-primary btn-sm"
            style={{ alignSelf: 'flex-start' }}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(fresh)
                setCopied(true)
              } catch {
                toast('Select the token and copy it manually', { error: true })
              }
            }}
          >
            {copied ? 'Copied' : 'Copy token'}
          </button>
        </div>
      )}

      {tokens?.map((t) => (
        <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--line-3)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <span style={{ fontWeight: 500 }}>{t.name}</span>
            <span className="faint mono" style={{ fontSize: 12 }}>
              {t.prefix}… · {t.lastUsedAt ? `used ${ago(t.lastUsedAt).toLowerCase()}` : 'never used'}
            </span>
          </div>
          <button className="btn btn-outline btn-sm" onClick={() => revoke(t.id)}>
            Revoke
          </button>
        </div>
      ))}

      <button className="btn btn-outline" style={{ alignSelf: 'flex-start' }} onClick={create} disabled={busy || isDemo} title={isDemo ? 'Create your own account to use the extension' : undefined}>
        {busy ? 'Creating…' : 'Create extension token'}
      </button>
    </div>
  )
}
