'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { useAppData } from '@/components/AppData'
import StatusChip, { StageDot } from '@/components/StatusBadge'
import { LoadError, PageSkeleton } from '@/components/PageState'
import { ACTIVE_STATUSES, STATUS_LABEL, STATUSES } from '@/lib/constants'
import { ago, daysBetween, partOfDay } from '@/lib/dates'
import { closesLabel, closingSoon, countByDay, gotReply, lastNDays, needsFollowUp, streaks, upcomingInterviews, withinDays } from '@/lib/stats'

const BAR_H = 170

export default function OverviewPage() {
  const { applications, profile, loading, error, reload, openEditor } = useAppData()

  const data = useMemo(() => {
    const byDay = countByDay(applications)
    const days = lastNDays(byDay, 14)
    const recent90 = withinDays(applications, 90).filter((a) => a.appliedAt)
    return {
      days,
      today: days[days.length - 1].count,
      streak: streaks(byDay, profile?.dailyMin ?? 5),
      active: applications.filter((a) => ACTIVE_STATUSES.includes(a.status)).length,
      responseRate: recent90.length ? Math.round((recent90.filter(gotReply).length / recent90.length) * 100) : null,
      counts: Object.fromEntries(STATUSES.map((s) => [s, applications.filter((a) => a.status === s).length])),
      interviews: upcomingInterviews(applications).slice(0, 3),
      recent: [...applications].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5),
      followUp: needsFollowUp(applications).slice(0, 6),
      closing: closingSoon(applications).slice(0, 5),
    }
  }, [applications, profile?.dailyMin])

  if (loading) return <PageSkeleton />
  if (error || !profile) return <LoadError message={error ?? 'Profile missing'} onRetry={reload} />

  const min = profile.dailyMin
  const stretch = profile.dailyMax
  const { today } = data
  const left = Math.max(0, min - today)
  const firstName = profile.name?.split(' ')[0]
  const maxBar = Math.max(...data.days.map((d) => d.count), min, 1)
  const first = data.days[0].date

  return (
    <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span className="display" style={{ fontWeight: 700, fontSize: 30, letterSpacing: '-0.03em' }}>
          {partOfDay()}
          {firstName ? `, ${firstName}` : ''}.
        </span>
        <span className="muted" style={{ fontSize: 15 }}>
          {left
            ? `You've sent ${today} of ${min} applications today. ${left} more to hit your minimum.`
            : `You've hit today's minimum. ${Math.max(0, stretch - today)} more reaches your stretch goal.`}
        </span>
      </div>

      <div className="kpis">
        <div className="card card-18">
          <span className="muted" style={{ fontSize: 13 }}>Today</span>
          <span className="kpi-num">
            {today} <small>/ {min}</small>
          </span>
          <div className="track">
            <div style={{ width: `${Math.min(100, Math.round((today / min) * 100))}%` }} />
          </div>
        </div>
        <div className="card card-18">
          <span className="muted" style={{ fontSize: 13 }}>Streak</span>
          <span className="kpi-num">
            {data.streak.current} {data.streak.current === 1 ? 'day' : 'days'}
          </span>
          <span className="faint" style={{ fontSize: 12 }}>Best: {data.streak.best} days</span>
        </div>
        <div className="card card-18">
          <span className="muted" style={{ fontSize: 13 }}>Active pipeline</span>
          <span className="kpi-num">{data.active}</span>
          <span className="faint" style={{ fontSize: 12 }}>Applied through offer</span>
        </div>
        <div className="card card-18">
          <span className="muted" style={{ fontSize: 13 }}>Response rate</span>
          <span className="kpi-num">{data.responseRate === null ? '—' : `${data.responseRate}%`}</span>
          <span className="faint" style={{ fontSize: 12 }}>Last 90 days</span>
        </div>
      </div>

      <div>
        <nav aria-label="Pipeline by stage" className="pipeline-strip">
          {STATUSES.map((s) => (
            <Link
              key={s}
              href={`/dashboard/applications?status=${s}`}
              className="row-hover"
              style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8, borderRadius: 0, color: 'inherit', background: 'var(--surface)' }}
            >
              <span className="muted" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                <StageDot status={s} />
                <span className="truncate">{STATUS_LABEL[s]}</span>
              </span>
              <span className="display" style={{ fontWeight: 700, fontSize: 26 }}>
                {data.counts[s]}
              </span>
            </Link>
          ))}
        </nav>
      </div>

      <div className="split-16-1">
        <div className="card" style={{ gap: 16 }}>
          <div className="card-head">
            <span className="card-title">Last 14 days</span>
            <span className="muted" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
              <span style={{ width: 16, borderTop: '2px dashed var(--warn)' }} />
              Daily minimum ({min})
            </span>
          </div>
          <div className="bars" style={{ height: 180 }}>
            <div className="min-line" style={{ bottom: Math.round((min / maxBar) * BAR_H) }} />
            {data.days.map((d, i) => {
              const isToday = i === data.days.length - 1
              return (
                <div
                  key={d.key}
                  className="bar"
                  title={`${d.count} on ${d.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`}
                  style={{
                    height: Math.round((d.count / maxBar) * BAR_H),
                    background: isToday ? 'var(--lime)' : d.count >= min ? 'var(--forest)' : 'var(--bar-muted)',
                    animationDelay: `${i * 35}ms`,
                  }}
                />
              )
            })}
          </div>
          <div className="mono faint" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
            <span>{first.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
            <span>Today</span>
          </div>
        </div>

        <div className="card" style={{ gap: 12 }}>
          <span className="card-title">Upcoming interviews</span>
          {data.interviews.length === 0 && <span className="muted">No interviews scheduled. Set a date on any application in the Interview stage.</span>}
          {data.interviews.map((a) => {
            const d = new Date(a.interviewAt!)
            return (
              <button key={a.id} className="row-hover" onClick={() => openEditor({ app: a })} style={{ display: 'flex', gap: 14, alignItems: 'center', padding: 10, border: 'none', background: 'transparent', textAlign: 'left' }}>
                <div style={{ width: 48, flex: 'none', textAlign: 'center', padding: '6px 0', borderRadius: 8, background: 'var(--lime-tint)', display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: 11, color: 'oklch(0.4 0.1 140)', fontWeight: 600 }}>{d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()}</span>
                  <span className="display" style={{ fontWeight: 700, fontSize: 20, color: 'var(--heading)' }}>
                    {d.getDate()}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                  <span className="truncate" style={{ fontWeight: 600 }}>
                    {a.company}
                  </span>
                  <span className="muted truncate" style={{ fontSize: 13 }}>
                    {a.interviewType || 'Interview'} · {d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      <div className="split-16-1">
        <div className="card" style={{ gap: 6 }}>
          <div className="card-head" style={{ marginBottom: 6 }}>
            <span className="card-title">Recently updated</span>
            <Link href="/dashboard/applications" className="link-btn">
              View all
            </Link>
          </div>
          {data.recent.length === 0 && <span className="muted">Nothing yet. Press N to add your first application.</span>}
          {data.recent.map((a) => (
            <button
              key={a.id}
              className="row-hover"
              onClick={() => openEditor({ app: a })}
              style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto auto', gap: 16, alignItems: 'center', padding: 10, border: 'none', background: 'transparent', textAlign: 'left' }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                <span className="truncate" style={{ fontWeight: 600 }}>
                  {a.company}
                </span>
                <span className="muted truncate" style={{ fontSize: 13 }}>
                  {a.jobTitle}
                </span>
              </div>
              <StatusChip status={a.status} />
              <span className="faint" style={{ fontSize: 12, width: 64, textAlign: 'right' }}>
                {ago(a.updatedAt)}
              </span>
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
        {data.closing.length > 0 && (
          <div className="card" style={{ gap: 6 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 6 }}>
              <span className="card-title">Closing soon</span>
              <span className="muted" style={{ fontSize: 12 }}>
                Saved jobs with a deadline in the next two weeks
              </span>
            </div>
            {data.closing.map(({ app: a, daysLeft }) => (
              <button
                key={a.id}
                className="row-hover"
                onClick={() => openEditor({ app: a })}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: 10, border: 'none', background: 'transparent', textAlign: 'left' }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                  <span className="truncate" style={{ fontWeight: 600 }}>
                    {a.company}
                  </span>
                  <span className="muted truncate" style={{ fontSize: 13 }}>
                    {a.jobTitle}
                  </span>
                </div>
                <span className="mono" style={{ fontSize: 12, flex: 'none', color: daysLeft <= 2 ? 'var(--danger-text)' : 'var(--warn-text)' }}>
                  {closesLabel(daysLeft)}
                </span>
              </button>
            ))}
          </div>
        )}
        <div className="card" style={{ gap: 6 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 6 }}>
            <span className="card-title">Follow up</span>
            <span className="muted" style={{ fontSize: 12 }}>
              Sent over a week ago, no reply yet
            </span>
          </div>
          {data.followUp.length === 0 && <span className="muted">You&apos;re all caught up.</span>}
          {data.followUp.map((a) => (
            <button
              key={a.id}
              className="row-hover"
              onClick={() => openEditor({ app: a })}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: 10, border: 'none', background: 'transparent', textAlign: 'left' }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                <span className="truncate" style={{ fontWeight: 600 }}>
                  {a.company}
                </span>
                <span className="muted truncate" style={{ fontSize: 13 }}>
                  {a.jobTitle}
                </span>
              </div>
              <span className="mono" style={{ fontSize: 12, color: 'var(--warn-text)' }}>
                {daysBetween(a.appliedAt!)}d
              </span>
            </button>
          ))}
        </div>
        </div>
      </div>
    </div>
  )
}
