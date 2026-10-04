'use client'

import { useMemo, useState } from 'react'
import { signIn } from 'next-auth/react'
import { api, useAppData } from '@/components/AppData'
import { EmailLabelChip } from '@/components/StatusBadge'
import { PageSkeleton } from '@/components/PageState'
import { useToast } from '@/components/Toast'
import { EMAIL_SUGGEST, STATUS_LABEL, STATUS_RANK } from '@/lib/constants'
import { inboxTime } from '@/lib/dates'

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'interview', label: 'Interview' },
  { key: 'offer', label: 'Offer' },
  { key: 'rejection', label: 'Rejection' },
  { key: 'reply', label: 'Reply' },
  { key: 'confirmation', label: 'Confirmation' },
]

/** "Maya at Northwind Labs <maya@x>" → "Maya at Northwind Labs" */
function senderName(from: string | null) {
  if (!from) return 'Unknown sender'
  const m = from.match(/^\s*"?([^"<]+?)"?\s*<[^>]+>\s*$/)
  return m ? m[1] : from
}

function syncedLabel(iso: string | null) {
  if (!iso) return 'not synced yet'
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000)
  if (mins < 1) return 'last synced just now'
  if (mins < 60) return `last synced ${mins} minute${mins === 1 ? '' : 's'} ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `last synced ${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.round(hours / 24)
  return `last synced ${days} day${days === 1 ? '' : 's'} ago`
}

export default function InboxPage() {
  const { emails, gmail, applications, profile, loading, setStatus, openEditor, reload, reloadEmails } = useAppData()
  const { toast } = useToast()
  const [filter, setFilter] = useState('all')
  const [syncing, setSyncing] = useState(false)

  const rows = useMemo(() => emails.filter((e) => filter === 'all' || (e.category ?? 'reply') === filter), [emails, filter])

  if (loading || !gmail) return <PageSkeleton />

  const sync = async () => {
    setSyncing(true)
    try {
      const r = await api<{ added: number }>('/api/emails/sync', { method: 'POST' })
      await reload()
      toast(`Synced. ${r.added} new email${r.added === 1 ? '' : 's'} matched`)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Sync failed', { error: true })
      await reloadEmails()
    } finally {
      setSyncing(false)
    }
  }

  const connect = () => {
    if (!gmail.available) {
      toast('Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env to connect Gmail', { error: true })
      return
    }
    signIn('google', { callbackUrl: '/dashboard/emails' })
  }

  const card = gmail.connected
    ? {
        title: 'Gmail connected',
        body: `${profile?.email ?? 'Your inbox'} · ${syncedLabel(profile?.gmailSyncedAt ?? null)}. New recruiter emails are matched to your applications automatically.`,
        cta: syncing ? 'Syncing…' : 'Sync Gmail',
        onClick: sync,
      }
    : {
        title: 'Connect Gmail',
        body: 'Match recruiter emails to your applications and get suggestions to move them forward.',
        cta: 'Connect Gmail',
        onClick: connect,
      }

  return (
    <div className="page-enter inbox-grid">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {FILTERS.map((f) => (
            <button key={f.key} className="pill" aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}>
              {f.label}
            </button>
          ))}
        </div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, overflow: 'hidden' }}>
          {rows.length === 0 && (
            <div className="empty">
              {emails.length === 0
                ? gmail.connected
                  ? 'No matched emails yet. Sync to pull in replies about your applications.'
                  : 'Connect Gmail and replies about your applications will show up here.'
                : 'No emails with this label.'}
            </div>
          )}
          {rows.map((e) => {
            const app = applications.find((a) => a.id === e.applicationId)
            const status = app?.status ?? e.application.status
            const suggest = EMAIL_SUGGEST[e.category ?? 'reply']
            const canSuggest = Boolean(app && suggest && STATUS_RANK[suggest] > STATUS_RANK[status])
            return (
              <div key={e.id} style={{ padding: '16px 18px', borderBottom: '1px solid var(--line-3)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <span className="truncate" style={{ fontWeight: 600 }}>
                      {senderName(e.from)}
                    </span>
                    <EmailLabelChip category={e.category ?? 'reply'} />
                  </span>
                  <span className="faint" style={{ fontSize: 12, flex: 'none' }}>
                    {inboxTime(e.date)}
                  </span>
                </div>
                <span style={{ fontWeight: 500 }}>{e.subject || '(no subject)'}</span>
                <span className="muted" style={{ lineHeight: 1.45 }}>
                  {e.snippet}
                </span>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 2 }}>
                  <button className="link-btn" style={{ fontSize: 12 }} onClick={() => app && openEditor({ app })}>
                    Linked to {e.application.company} · {e.application.jobTitle}
                  </button>
                  {canSuggest && (
                    <button className="btn btn-lime btn-xs" style={{ marginLeft: 'auto' }} onClick={() => setStatus(app!, suggest!)}>
                      Move to {STATUS_LABEL[suggest!]}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div style={{ background: 'var(--forest)', color: '#fff', borderRadius: 14, padding: 20, display: 'flex', flexDirection: 'column', gap: 12, position: 'sticky', top: 96 }}>
        <span className="display" style={{ fontWeight: 700, fontSize: 20 }}>
          {card.title}
        </span>
        <span style={{ color: '#d3e0d8', lineHeight: 1.5, fontSize: 13, overflowWrap: 'anywhere' }}>{card.body}</span>
        <button className="btn btn-lime" style={{ height: 40 }} onClick={card.onClick} disabled={syncing}>
          {card.cta}
        </button>
        {!gmail.available && <span style={{ fontSize: 11, color: '#b9cbc0' }}>Needs Google keys in .env</span>}
      </div>
    </div>
  )
}
