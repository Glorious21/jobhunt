// Date helpers — all bucketing happens in the viewer's local timezone.

export const DAY_MS = 86_400_000

export function startOfDay(d: Date | number = new Date()) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

export function addDays(d: Date, n: number) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

/** Local calendar key, e.g. "2026-10-04". */
export function dayKey(d: Date | string | number) {
  const x = new Date(d)
  const m = String(x.getMonth() + 1).padStart(2, '0')
  const day = String(x.getDate()).padStart(2, '0')
  return `${x.getFullYear()}-${m}-${day}`
}

/** Monday-based start of week. */
export function startOfWeek(d: Date = new Date()) {
  const x = startOfDay(d)
  const dow = (x.getDay() + 6) % 7
  return addDays(x, -dow)
}

export function daysBetween(a: Date | string, b: Date | string = new Date()) {
  return Math.floor((startOfDay(new Date(b)).getTime() - startOfDay(new Date(a)).getTime()) / DAY_MS)
}

const rtf = typeof Intl !== 'undefined' ? new Intl.RelativeTimeFormat('en', { numeric: 'auto' }) : null

export function relative(date: string | Date | null | undefined) {
  if (!date) return '—'
  const d = new Date(date)
  const diff = d.getTime() - Date.now()
  const abs = Math.abs(diff)
  if (!rtf) return d.toLocaleDateString()
  if (abs < 60_000) return 'just now'
  if (abs < 3_600_000) return rtf.format(Math.round(diff / 60_000), 'minute')
  if (abs < DAY_MS) return rtf.format(Math.round(diff / 3_600_000), 'hour')
  const days = Math.round((startOfDay(d).getTime() - startOfDay().getTime()) / DAY_MS)
  if (Math.abs(days) < 7) return rtf.format(days, 'day')
  if (Math.abs(days) < 30) return rtf.format(Math.round(days / 7), 'week')
  return formatDate(d)
}

export function formatDate(date: string | Date | null | undefined, opts?: Intl.DateTimeFormatOptions) {
  if (!date) return '—'
  const d = new Date(date)
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return d.toLocaleDateString(undefined, opts ?? { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) })
}

export function formatDateTime(date: string | Date | null | undefined) {
  if (!date) return '—'
  const d = new Date(date)
  return `${formatDate(d, { weekday: 'short', month: 'short', day: 'numeric' })}, ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`
}

/** Value for <input type="datetime-local"> in local time. */
export function toLocalInput(date: string | Date | null | undefined, withTime = true) {
  if (!date) return ''
  const d = new Date(date)
  const pad = (n: number) => String(n).padStart(2, '0')
  const base = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  return withTime ? `${base}T${pad(d.getHours())}:${pad(d.getMinutes())}` : base
}

export function greeting(d = new Date()) {
  const h = d.getHours()
  if (h < 5) return 'Working late'
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

/** "Just now" / "Nm ago" / "Nh ago" / "Nd ago" — the design's relative format. */
export function ago(date: string | Date | null | undefined) {
  if (!date) return '—'
  const mins = Math.max(0, Math.round((Date.now() - new Date(date).getTime()) / 60_000))
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`
  return `${Math.round(mins / 1440)}d ago`
}

/** "12 Sep" */
export function shortDate(date: string | Date | null | undefined) {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

/** Inbox time: "9:12" today, "Yesterday", weekday within a week, else "Sep 29". */
export function inboxTime(date: string | Date | null | undefined) {
  if (!date) return ''
  const d = new Date(date)
  const days = daysBetween(d)
  if (days <= 0) return d.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' })
  if (days === 1) return 'Yesterday'
  if (days < 7) return d.toLocaleDateString('en-US', { weekday: 'short' })
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** "Good morning" etc. */
export function partOfDay(d = new Date()) {
  const h = d.getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}
