'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { signOut } from 'next-auth/react'
import { useAppData } from '@/components/AppData'
import { useToast } from '@/components/Toast'
import { takePendingApply } from '@/lib/pending-apply'
import ApplicationEditor from '@/components/ApplicationEditor'
import { Logo } from '@/components/Logo'

const NAV = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/dashboard/applications', label: 'Applications', count: 'apps' as const },
  { href: '/dashboard/jobs', label: 'Find jobs' },
  { href: '/dashboard/resume', label: 'CV & tailoring' },
  { href: '/dashboard/goals', label: 'Daily goal' },
  { href: '/dashboard/analytics', label: 'Analytics' },
  { href: '/dashboard/emails', label: 'Inbox', count: 'emails' as const },
  { href: '/dashboard/settings', label: 'Settings' },
]

function isActive(pathname: string, href: string) {
  return href === '/dashboard' ? pathname === href : pathname.startsWith(href)
}

function initials(name: string | null | undefined, email: string | null | undefined) {
  const source = (name || email || '?').trim()
  const parts = source.split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?'
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { applications, emails, profile, editor, openEditor, closeEditor, setStatus } = useAppData()
  const { toast } = useToast()
  const [navOpen, setNavOpen] = useState(false)
  const [search, setSearch] = useState('')

  // Close the mobile nav whenever the route changes.
  const [lastPath, setLastPath] = useState(pathname)
  if (lastPath !== pathname) {
    setLastPath(pathname)
    setNavOpen(false)
  }

  // N opens "Add application" (outside inputs, with no panel or dialog open).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null
      const typing = el && (/INPUT|TEXTAREA|SELECT/.test(el.tagName) || el.isContentEditable)
      const overlayOpen = document.querySelector('.panel-backdrop, .dialog-backdrop')
      if ((e.key === 'n' || e.key === 'N') && !e.metaKey && !e.ctrlKey && !e.altKey && !typing && !overlayOpen) {
        e.preventDefault()
        openEditor({})
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openEditor])

  // Paste a job post anywhere in the dashboard (outside a text field) to add it.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const el = document.activeElement as HTMLElement | null
      if (el && (/INPUT|TEXTAREA|SELECT/.test(el.tagName) || el.isContentEditable)) return
      if (document.querySelector('.panel-backdrop, .dialog-backdrop')) return
      const text = e.clipboardData?.getData('text/plain') ?? ''
      if (text.trim().length < 60) return
      e.preventDefault()
      openEditor({ post: text })
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [openEditor])

  // Back from an application page: ask whether it was sent, so it counts toward the streak.
  useEffect(() => {
    const check = () => {
      if (document.visibilityState !== 'visible') return
      const pending = takePendingApply()
      if (!pending) return
      const app = applications.find((a) => a.id === pending.id)
      if (!app || app.status !== 'SAVED') return
      toast(`Did you apply to ${pending.company}?`, {
        action: { label: 'Mark applied', onClick: () => setStatus(app, 'APPLIED') },
        duration: 15000,
      })
    }
    document.addEventListener('visibilitychange', check)
    window.addEventListener('focus', check)
    return () => {
      document.removeEventListener('visibilitychange', check)
      window.removeEventListener('focus', check)
    }
  }, [applications, setStatus, toast])

  const current = NAV.filter((n) => isActive(pathname, n.href)).sort((a, b) => b.href.length - a.href.length)[0]
  const counts = { apps: applications.length, emails: emails.length }

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const q = search.trim()
    router.push(q ? `/dashboard/applications?q=${encodeURIComponent(q)}` : '/dashboard/applications')
  }

  return (
    <div className="shell">
      <div className="scrim" data-open={navOpen} onClick={() => setNavOpen(false)} />
      <aside className="sidebar" data-open={navOpen}>
        <Link href="/" className="sidebar-logo" aria-label="jobhunt home">
          <Logo size={26} />
        </Link>
        <nav className="nav" aria-label="Main">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="nav-item" aria-current={isActive(pathname, n.href) ? 'page' : undefined}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="dot" />
                {n.label}
              </span>
              <span className="count">{n.count && counts[n.count] ? counts[n.count] : ''}</span>
            </Link>
          ))}
        </nav>
        <Link href="/dashboard/settings" className="user-card" style={{ color: 'inherit' }}>
          <span className="avatar">{initials(profile?.name, profile?.email)}</span>
          <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <span className="truncate" style={{ fontWeight: 600 }}>
              {profile?.name || 'Your account'}
            </span>
            <span className="truncate muted" style={{ fontSize: 12 }}>
              {profile?.targetRole || profile?.email || ''}
            </span>
          </span>
        </Link>
      </aside>

      <main className="main">
        {profile?.isDemo && (
          <div className="demo-banner">
            You&apos;re exploring a demo workspace with sample data.
            <button onClick={() => signOut({ callbackUrl: '/login?mode=signup' })}>Create your own account</button>
          </div>
        )}
        <header className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <button className="menu-toggle" onClick={() => setNavOpen(true)} aria-label="Open navigation">
              <span aria-hidden style={{ display: 'grid', gap: 3 }}>
                <i style={{ display: 'block', width: 14, height: 2, background: 'currentColor', borderRadius: 1 }} />
                <i style={{ display: 'block', width: 14, height: 2, background: 'currentColor', borderRadius: 1 }} />
                <i style={{ display: 'block', width: 14, height: 2, background: 'currentColor', borderRadius: 1 }} />
              </span>
            </button>
            <h1 className="truncate">{current?.label ?? ''}</h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <form className="topbar-search" role="search" onSubmit={submitSearch}>
              <span className="search-glyph" aria-hidden />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search applications" aria-label="Search applications" />
            </form>
            <button className="btn btn-primary" style={{ padding: '0 10px 0 16px' }} onClick={() => openEditor({})}>
              Add application<span className="kbd">N</span>
            </button>
          </div>
        </header>
        <div className="content">{children}</div>
      </main>

      {editor && <ApplicationEditor key={editor.app?.id ?? `new-${editor.post?.length ?? 0}`} app={editor.app} initial={editor.initial} post={editor.post} onClose={closeEditor} />}
    </div>
  )
}
