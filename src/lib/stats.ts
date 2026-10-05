import { ACTIVE_STATUSES, REPLY_STATUSES, SENT_STATUSES, STATUSES, type Source, type Status } from './constants'
import { addDays, dayKey, DAY_MS, startOfDay, startOfWeek } from './dates'
import type { Application } from './types'

export function countByDay(apps: Application[]) {
  const map = new Map<string, number>()
  for (const a of apps) {
    if (!a.appliedAt) continue
    const k = dayKey(a.appliedAt)
    map.set(k, (map.get(k) ?? 0) + 1)
  }
  return map
}

export function lastNDays(byDay: Map<string, number>, n: number) {
  const today = startOfDay()
  return Array.from({ length: n }, (_, i) => {
    const date = addDays(today, i - (n - 1))
    return { date, key: dayKey(date), count: byDay.get(dayKey(date)) ?? 0 }
  })
}

/** Consecutive days (ending today, or yesterday if today isn't done yet) meeting the minimum. */
export function streaks(byDay: Map<string, number>, min: number) {
  const today = startOfDay()
  let current = 0
  let cursor = (byDay.get(dayKey(today)) ?? 0) >= min ? today : addDays(today, -1)
  while ((byDay.get(dayKey(cursor)) ?? 0) >= min) {
    current++
    cursor = addDays(cursor, -1)
  }

  let best = 0
  const keys = [...byDay.keys()].sort()
  if (keys.length) {
    let run = 0
    let d = new Date(`${keys[0]}T00:00:00`)
    while (d <= today) {
      if ((byDay.get(dayKey(d)) ?? 0) >= min) {
        run++
        best = Math.max(best, run)
      } else run = 0
      d = addDays(d, 1)
    }
  }
  return { current, best: Math.max(best, current) }
}

export function weeklyTotals(apps: Application[], weeks: number) {
  const thisWeek = startOfWeek()
  const buckets = Array.from({ length: weeks }, (_, i) => ({
    start: addDays(thisWeek, (i - (weeks - 1)) * 7),
    count: 0,
  }))
  const first = buckets[0].start.getTime()
  for (const a of apps) {
    if (!a.appliedAt) continue
    const t = new Date(a.appliedAt).getTime()
    if (t < first) continue
    const idx = Math.floor((startOfWeek(new Date(t)).getTime() - first) / (7 * DAY_MS) + 0.01)
    if (buckets[idx]) buckets[idx].count++
  }
  return buckets
}

export function summarize(apps: Application[]) {
  const byStatus = Object.fromEntries(
    STATUSES.map((s) => [s, 0])
  ) as Record<Status, number>
  for (const a of apps) byStatus[a.status]++

  const sent = apps.filter((a) => SENT_STATUSES.includes(a.status) || a.appliedAt)
  const responded = sent.filter(gotReply)
  const interviewed = sent.filter((a) => ['INTERVIEW', 'OFFER', 'HIRED'].includes(a.status) || a.interviewAt)
  const offers = sent.filter((a) => a.status === 'OFFER' || a.status === 'HIRED')
  const active = apps.filter((a) => ACTIVE_STATUSES.includes(a.status))

  const responseDays = responded
    .filter((a) => a.appliedAt && a.respondedAt)
    .map((a) => (new Date(a.respondedAt!).getTime() - new Date(a.appliedAt!).getTime()) / DAY_MS)
    .filter((d) => d >= 0)
    .sort((a, b) => a - b)
  const medianResponseDays = responseDays.length ? responseDays[Math.floor(responseDays.length / 2)] : null

  return {
    total: apps.length,
    byStatus,
    sent: sent.length,
    responded: responded.length,
    interviewed: interviewed.length,
    offers: offers.length,
    active: active.length,
    responseRate: sent.length ? responded.length / sent.length : 0,
    interviewRate: sent.length ? interviewed.length / sent.length : 0,
    medianResponseDays,
  }
}

export function bySource(apps: Application[]) {
  const map = new Map<Source, { total: number; responded: number }>()
  for (const a of apps) {
    if (!a.appliedAt) continue
    const v = map.get(a.source) ?? { total: 0, responded: 0 }
    v.total++
    if (gotReply(a)) v.responded++
    map.set(a.source, v)
  }
  return [...map.entries()].map(([source, v]) => ({ source, ...v })).sort((a, b) => b.total - a.total)
}

/** Applications sent a while ago with no reply — worth a follow-up. */
export function needsFollowUp(apps: Application[], afterDays = 7) {
  const cutoff = Date.now() - afterDays * DAY_MS
  return apps
    .filter((a) => a.status === 'APPLIED' && a.appliedAt && new Date(a.appliedAt).getTime() < cutoff)
    .sort((a, b) => new Date(a.appliedAt!).getTime() - new Date(b.appliedAt!).getTime())
}

export function upcomingInterviews(apps: Application[]) {
  const now = Date.now() - 2 * 3_600_000
  return apps
    .filter((a) => a.interviewAt && new Date(a.interviewAt).getTime() >= now && a.status !== 'REJECTED')
    .sort((a, b) => new Date(a.interviewAt!).getTime() - new Date(b.interviewAt!).getTime())
}

export function pct(n: number) {
  return `${Math.round(n * 100)}%`
}

/** Applications applied (or created) within the last `days` days; 0 = all. */
export function withinDays(apps: Application[], days: number) {
  if (!days) return apps
  const cutoff = Date.now() - days * DAY_MS
  return apps.filter((a) => new Date(a.appliedAt ?? a.createdAt).getTime() >= cutoff)
}

/** An employer replied. "Rejected" without a reply date means ghosted/withdrawn, not a reply. */
export function gotReply(a: Application) {
  return Boolean(a.respondedAt) || REPLY_STATUSES.includes(a.status)
}

/** Saved (not yet sent) jobs whose deadline is today or within `days`, soonest first. */
export function closingSoon(apps: Application[], days = 14) {
  const today = startOfDay().getTime()
  const limit = today + (days + 1) * DAY_MS
  return apps
    .filter((a) => a.status === 'SAVED' && a.deadline)
    .map((a) => ({ app: a, daysLeft: Math.round((startOfDay(new Date(a.deadline!)).getTime() - today) / DAY_MS) }))
    .filter((x) => x.daysLeft >= 0 && startOfDay(new Date(x.app.deadline!)).getTime() < limit)
    .sort((a, b) => a.daysLeft - b.daysLeft)
}

export function closesLabel(daysLeft: number) {
  return daysLeft === 0 ? 'Closes today' : daysLeft === 1 ? 'Closes tomorrow' : `Closes in ${daysLeft} days`
}
