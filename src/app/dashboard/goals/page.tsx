'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useAppData } from '@/components/AppData'
import { LoadError, PageSkeleton } from '@/components/PageState'
import { addDays, dayKey, startOfDay, startOfWeek } from '@/lib/dates'
import { countByDay, streaks, weeklyTotals } from '@/lib/stats'

const WEEKS = 16
const HEAT = ['var(--heat-0)', 'var(--heat-1)', 'var(--heat-2)', 'var(--heat-3)', 'var(--heat-4)']

export default function GoalsPage() {
  const { applications, profile, loading, error, reload, updateProfile } = useAppData()
  const [min, setMin] = useState(profile?.dailyMin ?? 5)
  const [stretch, setStretch] = useState(profile?.dailyMax ?? 8)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [pending, setPending] = useState(false)

  // Sync the steppers once the profile arrives (or changes elsewhere).
  const [synced, setSynced] = useState(profile ? `${profile.dailyMin}/${profile.dailyMax}` : '')
  if (profile && synced !== `${profile.dailyMin}/${profile.dailyMax}` && !pending) {
    setSynced(`${profile.dailyMin}/${profile.dailyMax}`)
    setMin(profile.dailyMin)
    setStretch(profile.dailyMax)
  }

  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
  }, [])

  // Targets update instantly on screen and save shortly after the last click.
  const commit = (nextMin: number, nextStretch: number) => {
    setMin(nextMin)
    setStretch(nextStretch)
    setPending(true)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      saveTimer.current = null
      await updateProfile({ dailyMin: nextMin, dailyMax: nextStretch })
      if (!saveTimer.current) setPending(false)
    }, 500)
  }

  const data = useMemo(() => {
    const byDay = countByDay(applications)
    const today = startOfDay()
    const start = addDays(startOfWeek(today), -(WEEKS - 1) * 7)
    const cells = Array.from({ length: WEEKS * 7 }, (_, i) => {
      const date = addDays(start, i)
      return { key: dayKey(date), date, count: byDay.get(dayKey(date)) ?? 0, future: date > today }
    })
    const last30 = Array.from({ length: 30 }, (_, i) => byDay.get(dayKey(addDays(today, -i))) ?? 0)
    return { byDay, todayCount: byDay.get(dayKey(today)) ?? 0, cells, last30, weeks: weeklyTotals(applications, 8) }
  }, [applications])

  if (loading) return <PageSkeleton />
  if (error || !profile) return <LoadError message={error ?? 'Profile missing'} onRetry={reload} />

  const streak = streaks(data.byDay, min)
  const hit30 = data.last30.filter((c) => c >= min).length
  const left = Math.max(0, min - data.todayCount)
  const pct = Math.min(100, Math.round((data.todayCount / min) * 100))
  const level = (c: number) => (c === 0 ? 0 : c < min / 2 ? 1 : c < min ? 2 : c < stretch ? 3 : 4)
  const weekMax = Math.max(...data.weeks.map((w) => w.count), 1)

  return (
    <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        <div className="card" style={{ flexDirection: 'row', gap: 18, alignItems: 'center' }}>
          <div className="ring" style={{ width: 104, height: 104, ['--p' as string]: pct }}>
            <div style={{ width: 80, height: 80 }}>
              <span className="display" style={{ fontWeight: 800, fontSize: 26, lineHeight: 1 }}>
                {data.todayCount}
              </span>
              <span className="faint" style={{ fontSize: 11 }}>
                of {min}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontWeight: 600 }}>Today</span>
            <span className="muted" style={{ fontSize: 13, lineHeight: 1.45 }}>
              {left
                ? `${left} more to keep your streak. Stretch goal is ${stretch}.`
                : `Minimum hit. ${Math.max(0, stretch - data.todayCount)} more for your stretch goal.`}
            </span>
          </div>
        </div>
        <div className="card" style={{ gap: 8 }}>
          <span className="muted" style={{ fontSize: 13 }}>Streak</span>
          <span className="display" style={{ fontWeight: 700, fontSize: 34 }}>
            {streak.current} {streak.current === 1 ? 'day' : 'days'}
          </span>
          <span className="faint" style={{ fontSize: 13 }}>Best streak: {streak.best} days</span>
        </div>
        <div className="card" style={{ gap: 8 }}>
          <span className="muted" style={{ fontSize: 13 }}>Last 30 days</span>
          <span className="display" style={{ fontWeight: 700, fontSize: 34 }}>
            {hit30} <span className="faint" style={{ fontSize: 18 }}>/ 30</span>
          </span>
          <span className="faint" style={{ fontSize: 13 }}>Days you hit your minimum</span>
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span className="card-title">Last 16 weeks</span>
          <span className="faint" style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: 11 }}>
            Less
            {HEAT.map((c) => (
              <span key={c} style={{ width: 12, height: 12, borderRadius: 3, background: c }} />
            ))}
            More
          </span>
        </div>
        <div role="img" aria-label="Applications per day over the last 16 weeks" style={{ display: 'grid', gridTemplateRows: 'repeat(7, 16px)', gridAutoFlow: 'column', gridAutoColumns: '16px', gap: 4, overflowX: 'auto' }}>
          {data.cells.map((c) => (
            <span
              key={c.key}
              title={c.future ? undefined : `${c.count} application${c.count === 1 ? '' : 's'} · ${c.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`}
              style={{ borderRadius: 4, background: c.future ? 'transparent' : HEAT[level(c.count)] }}
            />
          ))}
        </div>
      </div>

      <div className="split-15-1">
        <div className="card">
          <span className="card-title">Weekly totals</span>
          <div style={{ height: 160, display: 'flex', alignItems: 'flex-end', gap: 12, borderBottom: '1px solid var(--line)' }}>
            {data.weeks.map((w, i) => (
              <div key={w.start.toISOString()} title={`Week of ${w.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <span className="mono muted" style={{ fontSize: 11 }}>
                  {w.count}
                </span>
                <div className="bar" style={{ width: '100%', flex: 'none', background: 'var(--forest)', height: Math.round((w.count / weekMax) * 130), animationDelay: `${i * 50}ms` }} />
              </div>
            ))}
          </div>
        </div>
        <div className="card" style={{ gap: 12 }}>
          <span className="card-title">Your targets</span>
          <TargetRow
            label="Daily minimum"
            hint="Keeps your streak"
            value={min}
            onDown={() => commit(Math.max(1, min - 1), stretch)}
            onUp={() => commit(Math.min(50, min + 1), Math.max(stretch, Math.min(50, min + 1)))}
          />
          <TargetRow label="Stretch goal" hint="For good days" value={stretch} onDown={() => commit(min, Math.max(min, stretch - 1))} onUp={() => commit(min, Math.min(50, stretch + 1))} />
        </div>
      </div>
    </div>
  )
}

function TargetRow({ label, hint, value, onDown, onUp }: { label: string; hint: string; value: number; onDown: () => void; onUp: () => void }) {
  return (
    <div className="inset" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontWeight: 500 }}>{label}</span>
        <span className="faint" style={{ fontSize: 12 }}>
          {hint}
        </span>
      </div>
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
