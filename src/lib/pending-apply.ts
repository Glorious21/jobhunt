'use client'

// Remembers a job whose application page was just opened, so that when the user comes back
// to jobhunt we can ask "Did you apply?" and count it toward today's goal.

const KEY = 'jh-pending-apply'
const MAX_AGE = 6 * 3_600_000

export interface PendingApply {
  id: string
  company: string
  at: number
}

export function markPendingApply(p: Omit<PendingApply, 'at'>) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ ...p, at: Date.now() }))
  } catch {}
}

/** Returns and clears the pending job, if it's at least `minAway` ms old. */
export function takePendingApply(minAway = 4000): PendingApply | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as PendingApply
    const age = Date.now() - p.at
    if (age < minAway) return null
    sessionStorage.removeItem(KEY)
    return age < MAX_AGE ? p : null
  } catch {
    return null
  }
}
