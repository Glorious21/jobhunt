import Link from 'next/link'
import { auth } from '@/lib/auth'
import { Logo } from '@/components/Logo'
import DemoButton from '@/components/DemoButton'

const FEATURES = [
  { n: '01', t: 'Pipeline tracking', d: 'Seven stages from saved to offer, in a table or a drag-and-drop board.' },
  { n: '02', t: 'Daily goals', d: 'Set a minimum and a stretch goal. Keep a streak going.' },
  { n: '03', t: 'CV tailoring', d: 'Check your CV against any posting and see which skills are missing.' },
  { n: '04', t: 'Job search', d: 'Search listings and save or track them in one click.' },
  { n: '05', t: 'Inbox matching', d: 'Recruiter emails are linked to the right application and labelled.' },
  { n: '06', t: 'Analytics', d: 'Response rates, funnel conversion and which channels get replies.' },
]

const STEPS = [
  { n: '1', t: 'Set your target', d: 'Pick a role, a location and how many applications you want to send each day.' },
  { n: '2', t: 'Apply and track', d: 'Add applications as you send them, or straight from the job search.' },
  { n: '3', t: 'Follow the replies', d: 'Connect Gmail and watch applications move forward on their own.' },
]

// Product preview: last 14 days with today = 3 against a minimum of 5.
const PREVIEW = [4, 6, 5, 7, 3, 5, 6, 2, 5, 8, 6, 5, 4, 3]
const PREVIEW_MIN = 5

export default async function Home() {
  const session = await auth()
  const signedIn = Boolean(session?.user)
  const max = Math.max(...PREVIEW, PREVIEW_MIN, 1)

  return (
    <div className="page-enter" style={{ background: 'var(--bg)' }}>
      <header className="lp-wrap lp-header">
        <Link href="/" aria-label="jobhunt home">
          <Logo size={28} />
        </Link>
        <nav className="lp-nav" aria-label="Sections">
          <a href="#features">Features</a>
          <a href="#how">How it works</a>
          {signedIn ? <Link href="/dashboard">Demo</Link> : <DemoButton>Demo</DemoButton>}
        </nav>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {signedIn ? (
            <>
              <Link href="/login" className="btn btn-quiet" style={{ padding: '0 16px' }}>
                Sign in
              </Link>
              <Link href="/dashboard" className="btn btn-primary">
                Open dashboard
              </Link>
            </>
          ) : (
            <>
              <Link href="/login" className="btn btn-quiet" style={{ padding: '0 16px' }}>
                Sign in
              </Link>
              <Link href="/login?mode=signup" className="btn btn-primary">
                Get started
              </Link>
            </>
          )}
        </div>
      </header>

      <section className="lp-wrap lp-hero">
        <div className="lp-badge">
          <b>New</b>Recruiter emails now sort themselves into your pipeline
        </div>
        <h1 className="lp-h1 fade-up" style={{ animationDelay: '0.05s' }}>
          Run your job search like a pipeline.
        </h1>
        <p className="lp-sub fade-up" style={{ animationDelay: '0.12s' }}>
          Track every application, hit a daily goal, tailor your CV to each posting and see which channels actually get replies.
        </p>
        <div className="fade-up" style={{ animationDelay: '0.19s', display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link href={signedIn ? '/dashboard' : '/login?mode=signup'} className="btn btn-primary btn-lg">
            {signedIn ? 'Open dashboard' : 'Start free'}
          </Link>
          {!signedIn && (
            <DemoButton className="btn btn-outline btn-lg" >
              Explore the demo
            </DemoButton>
          )}
        </div>
        <div className="lp-preview fade-up" style={{ animationDelay: '0.28s' }} aria-hidden>
          <div className="lp-preview-inner">
            <div className="lp-mini">
              <span>Today</span>
              <strong>3 / 5</strong>
              <div className="track">
                <div style={{ width: '60%' }} />
              </div>
            </div>
            <div className="lp-mini">
              <span>Streak</span>
              <strong>6 days</strong>
            </div>
            <div className="lp-mini">
              <span>Active pipeline</span>
              <strong>8</strong>
            </div>
            <div className="lp-mini">
              <span>Response rate</span>
              <strong>27%</strong>
            </div>
            <div className="lp-mini" style={{ gridColumn: '1 / -1', flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 150 }}>
              {PREVIEW.map((v, i) => {
                const isToday = i === PREVIEW.length - 1
                return (
                  <div
                    key={i}
                    className="bar"
                    style={{
                      borderRadius: '4px 4px 0 0',
                      height: Math.round((v / max) * 170),
                      background: isToday ? 'var(--lime)' : v >= PREVIEW_MIN ? 'var(--forest)' : 'var(--bar-muted)',
                      animationDelay: `${i * 35}ms`,
                    }}
                  />
                )
              })}
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="lp-wrap lp-section">
        <h2 className="lp-h2" style={{ maxWidth: 640 }}>
          Everything a search needs, in one place.
        </h2>
        <div className="lp-features">
          {FEATURES.map((f) => (
            <div key={f.n}>
              <span className="n">{f.n}</span>
              <span className="t">{f.t}</span>
              <span className="d">{f.d}</span>
            </div>
          ))}
        </div>
      </section>

      <section id="how" className="lp-wrap lp-section" style={{ paddingBottom: 112 }}>
        <h2 className="lp-h2">How it works</h2>
        <div className="lp-steps">
          {STEPS.map((s) => (
            <div key={s.n}>
              <span className="n">{s.n}</span>
              <span className="t">{s.t}</span>
              <span className="d">{s.d}</span>
            </div>
          ))}
        </div>
        <div className="lp-cta">
          <span>Set your pace. Send the applications. Track the replies.</span>
          <Link href={signedIn ? '/dashboard' : '/login?mode=signup'} className="btn btn-lime btn-lg">
            {signedIn ? 'Open dashboard' : 'Create your account'}
          </Link>
        </div>
      </section>
    </div>
  )
}
