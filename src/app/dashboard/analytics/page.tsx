'use client'

import { useMemo, useState } from 'react'
import { useAppData } from '@/components/AppData'
import { StageDot } from '@/components/StatusBadge'
import { LoadError, PageSkeleton } from '@/components/PageState'
import { SOURCE_LABEL, STATUS_LABEL, STATUSES } from '@/lib/constants'
import { bySource, summarize, weeklyTotals, withinDays } from '@/lib/stats'

const RANGES = [
  { key: 30, label: '30 days' },
  { key: 90, label: '90 days' },
  { key: 0, label: 'All time' },
]

export default function AnalyticsPage() {
  const { applications, loading, error, reload } = useAppData()
  const [range, setRange] = useState(90)
  const [chMode, setChMode] = useState<'volume' | 'rate'>('volume')

  const data = useMemo(() => {
    const scoped = withinDays(applications, range)
    const s = summarize(scoped)
    const funnel = [
      { label: 'Applied', v: s.sent },
      { label: 'Replied', v: s.responded },
      { label: 'Interviewed', v: s.interviewed },
      { label: 'Offer', v: s.offers },
    ]
    return { s, funnel, channels: bySource(scoped).slice(0, 6), weeks: weeklyTotals(applications, 12) }
  }, [applications, range])

  if (loading) return <PageSkeleton />
  if (error) return <LoadError message={error} onRetry={reload} />

  const { s } = data
  const pct = (n: number) => `${Math.round(n * 100)}%`
  const kpis = [
    { label: 'Applications sent', value: String(s.sent) },
    { label: 'Response rate', value: s.sent ? pct(s.responseRate) : '—' },
    { label: 'Interview rate', value: s.sent ? pct(s.interviewRate) : '—' },
    { label: 'Typical reply time', value: s.medianResponseDays === null ? '—' : `${s.medianResponseDays.toFixed(1)} days` },
  ]
  const channelRows = data.channels.map((c) => ({ name: SOURCE_LABEL[c.source], volume: c.total, rate: c.total ? Math.round((c.responded / c.total) * 100) : 0 }))
  const maxVolume = Math.max(1, ...channelRows.map((c) => c.volume))
  const maxRate = Math.max(1, ...channelRows.map((c) => c.rate))
  const weekMax = Math.max(1, ...data.weeks.map((w) => w.count))
  const total = applications.length

  return (
    <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="seg" role="group" aria-label="Date range">
        {RANGES.map((r) => (
          <button key={r.key} aria-pressed={range === r.key} onClick={() => setRange(r.key)}>
            {r.label}
          </button>
        ))}
      </div>

      <div className="kpis">
        {kpis.map((k) => (
          <div key={k.label} className="card card-18" style={{ gap: 8 }}>
            <span className="muted" style={{ fontSize: 13 }}>
              {k.label}
            </span>
            <span className="kpi-num">{k.value}</span>
          </div>
        ))}
      </div>

      <div className="split-1-1">
        <div className="card">
          <span className="card-title">Funnel</span>
          {data.funnel.map((f, i) => {
            const prev = i ? data.funnel[i - 1].v : 0
            return (
              <div key={f.label} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ fontWeight: 500 }}>{f.label}</span>
                  <span className="mono muted">
                    {f.v} {i > 0 && <span style={{ color: 'oklch(0.45 0.1 150)' }}>{prev ? `${Math.round((f.v / prev) * 100)}%` : '—'}</span>}
                  </span>
                </div>
                <div className="funnel-track">
                  <div style={{ width: `${Math.max(4, Math.round((f.v / Math.max(1, data.funnel[0].v)) * 100))}%`, background: i === 3 ? 'var(--lime)' : 'var(--forest)' }} />
                </div>
              </div>
            )
          })}
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <span className="card-title">By channel</span>
            <div className="seg seg-sm" role="group" aria-label="Channel metric">
              <button aria-pressed={chMode === 'volume'} onClick={() => setChMode('volume')}>
                Volume
              </button>
              <button aria-pressed={chMode === 'rate'} onClick={() => setChMode('rate')}>
                Reply rate
              </button>
            </div>
          </div>
          {channelRows.length === 0 && <span className="muted">No applications sent in this range.</span>}
          {channelRows.map((c) => (
            <div key={c.name} style={{ display: 'grid', gridTemplateColumns: '110px minmax(0,1fr) 48px', gap: 12, alignItems: 'center', fontSize: 13 }}>
              <span className="truncate">{c.name}</span>
              <div className="hbar-track">
                <div style={{ width: `${Math.round(((chMode === 'volume' ? c.volume : c.rate) / (chMode === 'volume' ? maxVolume : maxRate)) * 100)}%` }} />
              </div>
              <span className="mono muted" style={{ textAlign: 'right' }}>
                {chMode === 'volume' ? c.volume : `${c.rate}%`}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="split-15-1">
        <div className="card">
          <span className="card-title">Applications per week</span>
          <div className="bars" style={{ height: 170 }}>
            {data.weeks.map((w, i) => (
              <div
                key={w.start.toISOString()}
                className="bar"
                title={`${w.count} · week of ${w.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                style={{
                  borderRadius: '4px 4px 0 0',
                  height: Math.round((w.count / weekMax) * 150),
                  background: i === data.weeks.length - 1 ? 'var(--lime)' : 'var(--forest)',
                  animationDelay: `${i * 40}ms`,
                }}
              />
            ))}
          </div>
        </div>
        <div className="card" style={{ gap: 4 }}>
          <span className="card-title" style={{ marginBottom: 8 }}>
            Status breakdown
          </span>
          {STATUSES.map((st) => {
            const count = applications.filter((a) => a.status === st).length
            return (
              <div key={st} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 40px 48px', gap: 8, padding: '7px 0', borderBottom: '1px solid var(--line-3)', fontSize: 13 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <StageDot status={st} />
                  {STATUS_LABEL[st]}
                </span>
                <span className="mono" style={{ textAlign: 'right' }}>
                  {count}
                </span>
                <span className="mono faint" style={{ textAlign: 'right' }}>
                  {total ? `${Math.round((count / total) * 100)}%` : '—'}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
