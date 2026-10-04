import type { Metadata } from 'next'
import Link from 'next/link'
import { auth, githubEnabled, googleEnabled } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Logo } from '@/components/Logo'
import LoginForm from './LoginForm'

export const metadata: Metadata = { title: 'Sign in' }

const BENEFITS = [
  'Every application in one pipeline, from saved to offer',
  'A daily goal and streak to keep you moving',
  'Check your CV against any job posting',
  'Recruiter emails matched to the right application',
]

const ERRORS: Record<string, string> = {
  OAuthAccountNotLinked: 'That email is already registered with a different sign-in method.',
  AccessDenied: 'Access was denied.',
  Configuration: 'Sign-in is misconfigured on the server. Check NEXTAUTH_SECRET and provider keys.',
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams
  const next = params.next?.startsWith('/') && !params.next.startsWith('//') ? params.next : '/dashboard'
  const error = params.error ? ERRORS[params.error] ?? 'Sign-in failed. Please try again.' : undefined

  // Already signed in? Still show the page, with a way back to the dashboard or out.
  const session = await auth()
  const current = session?.user?.id
    ? await prisma.user.findUnique({ where: { id: session.user.id }, select: { name: true, email: true, isDemo: true } })
    : null
  const signedInAs = current ? (current.isDemo ? 'the demo workspace' : current.name || current.email || 'your account') : undefined

  return (
    <div className="auth page-enter">
      <div className="auth-side">
        <Link href="/" aria-label="jobhunt home" style={{ width: 'fit-content' }}>
          <Logo size={28} inverse />
        </Link>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28, maxWidth: 440 }}>
          <h2>Your whole search, organised.</h2>
          {BENEFITS.map((b) => (
            <div key={b} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <span style={{ flex: 'none', width: 22, height: 22, borderRadius: '50%', background: 'var(--lime)', marginTop: 1 }} />
              <span style={{ fontSize: 16, lineHeight: 1.45, color: '#e6efe9' }}>{b}</span>
            </div>
          ))}
        </div>
        <span style={{ fontSize: 13, color: '#b9cbc0' }}>Free while you search.</span>
      </div>
      <div className="auth-main">
        <LoginForm
          initialMode={params.mode === 'signup' ? 'signup' : 'signin'}
          next={next}
          serverError={error}
          google={googleEnabled}
          github={githubEnabled}
          signedInAs={signedInAs}
        />
      </div>
    </div>
  )
}
