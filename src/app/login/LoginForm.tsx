'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { signIn, signOut } from 'next-auth/react'
import { credentialsSignIn } from '@/lib/auth-client'

interface Props {
  initialMode: 'signin' | 'signup'
  next: string
  serverError?: string
  google: boolean
  github: boolean
  /** Set when a session already exists. */
  signedInAs?: string
}

export default function LoginForm({ initialMode, next, serverError, google, github, signedInAs }: Props) {
  const router = useRouter()
  const [mode, setMode] = useState(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | undefined>(serverError)

  const switchMode = (m: 'signin' | 'signup') => {
    setMode(m)
    setError(undefined)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      setError('Enter your email and password.')
      return
    }
    setError(undefined)
    setBusy('credentials')
    try {
      if (mode === 'signup') {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          setError(data.error || 'Could not create your account')
          return
        }
      }
      const res = await credentialsSignIn('credentials', { email, password })
      if (!res || res.error) {
        setError('Incorrect email or password.')
        return
      }
      router.replace(mode === 'signup' ? '/onboarding' : next)
      router.refresh()
    } finally {
      setBusy(null)
    }
  }

  const demo = async () => {
    setError(undefined)
    setBusy('demo')
    const res = await credentialsSignIn('demo')
    if (!res || res.error) {
      setError('Could not start the demo. Is the database reachable?')
      setBusy(null)
      return
    }
    router.replace('/dashboard')
    router.refresh()
  }

  const oauth = (provider: 'google' | 'github') => {
    setBusy(provider)
    signIn(provider, { callbackUrl: next })
  }

  return (
    <form className="auth-card" onSubmit={submit} noValidate>
      {signedInAs && (
        <div className="inset" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span>
            You’re signed in as <b>{signedInAs}</b>.
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <Link href={next} className="btn btn-primary btn-sm">
              Go to dashboard
            </Link>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => signOut({ callbackUrl: '/login' })}>
              Sign out
            </button>
          </div>
        </div>
      )}
      <div className="seg-auth" role="group" aria-label="Sign in or create account">
        <button type="button" aria-pressed={mode === 'signin'} onClick={() => switchMode('signin')}>
          Sign in
        </button>
        <button type="button" aria-pressed={mode === 'signup'} onClick={() => switchMode('signup')}>
          Create account
        </button>
      </div>
      <h1 className="auth-title">{mode === 'signin' ? 'Welcome back' : 'Create your account'}</h1>

      {(google || github) && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: google && github ? '1fr 1fr' : '1fr', gap: 10 }}>
            {google && (
              <button type="button" className="btn btn-outline" style={{ height: 44 }} onClick={() => oauth('google')} disabled={!!busy}>
                Google
              </button>
            )}
            {github && (
              <button type="button" className="btn btn-outline" style={{ height: 44 }} onClick={() => oauth('github')} disabled={!!busy}>
                GitHub
              </button>
            )}
          </div>
          <div className="or-line">or with email</div>
        </>
      )}

      <label className="field">
        Email
        <input className="input input-lg" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
      </label>
      <label className="field">
        Password
        <input
          className="input input-lg"
          type="password"
          placeholder="At least 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
        />
      </label>

      {error && (
        <span className="form-error" role="alert">
          {error}
        </span>
      )}

      <button type="submit" className="btn btn-primary" style={{ height: 46 }} disabled={!!busy}>
        {busy === 'credentials' ? (mode === 'signin' ? 'Signing in…' : 'Creating account…') : mode === 'signin' ? 'Sign in' : 'Create account'}
      </button>
      <button type="button" className="btn-demo" onClick={demo} disabled={!!busy}>
        {busy === 'demo' ? 'Opening demo…' : 'Explore a demo workspace'}
      </button>
      {(!google || !github) && (
        <span className="faint" style={{ fontSize: 12, lineHeight: 1.5 }}>
          Google and GitHub sign-in appear when their keys are set in .env.
        </span>
      )}
    </form>
  )
}
