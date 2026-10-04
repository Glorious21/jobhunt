'use client'

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Application, ApplicationInput, EmailItem, Profile } from '@/lib/types'
import { STATUS_LABEL, type Status } from '@/lib/constants'
import { countByDay, streaks } from '@/lib/stats'
import { dayKey } from '@/lib/dates'
import { useToast } from '@/components/Toast'
import Confetti from '@/components/Confetti'

export async function api<T>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: init?.json !== undefined ? { 'Content-Type': 'application/json', ...init?.headers } : init?.headers,
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
  return data as T
}

export type EmailRow = EmailItem & { application: { id: string; jobTitle: string; company: string; status: Status } }
export interface GmailState {
  available: boolean
  connected: boolean
}

type EditorTarget = { app?: Application; initial?: ApplicationInput; post?: string } | null

interface AppDataValue {
  applications: Application[]
  profile: Profile | null
  emails: EmailRow[]
  gmail: GmailState | null
  loading: boolean
  error: string | null
  reload: () => Promise<void>
  reloadEmails: () => Promise<void>
  createApplication: (input: ApplicationInput & { jobTitle: string; company: string }) => Promise<Application | null>
  updateApplication: (id: string, input: ApplicationInput) => Promise<Application | null>
  deleteApplication: (id: string) => Promise<boolean>
  /** Status change with an "{Company} moved to {Stage}" toast and Undo. */
  setStatus: (app: Application, status: Status) => Promise<void>
  /** True (once) if the last create/update crossed the daily minimum — callers skip their own toast. */
  takeGoalFlag: () => boolean
  updateProfile: (input: Partial<Profile>) => Promise<Profile | null>
  editor: EditorTarget
  openEditor: (target: Exclude<EditorTarget, null>) => void
  closeEditor: () => void
}

const AppDataContext = createContext<AppDataValue | null>(null)

export function useAppData() {
  const ctx = useContext(AppDataContext)
  if (!ctx) throw new Error('useAppData must be used inside <AppDataProvider>')
  return ctx
}

function todayCount(apps: Application[]) {
  const key = dayKey(new Date())
  return apps.filter((a) => a.appliedAt && dayKey(a.appliedAt) === key).length
}

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const { toast } = useToast()
  const [applications, setApplications] = useState<Application[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [emails, setEmails] = useState<EmailRow[]>([])
  const [gmail, setGmail] = useState<GmailState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editor, setEditor] = useState<EditorTarget>(null)
  const [celebrate, setCelebrate] = useState(0)

  // Latest values for async callbacks (kept in sync after each commit).
  const appsRef = useRef(applications)
  const profileRef = useRef(profile)
  useLayoutEffect(() => {
    appsRef.current = applications
    profileRef.current = profile
  }, [applications, profile])

  const goalFlag = useRef(false)
  const takeGoalFlag = useCallback(() => {
    const hit = goalFlag.current
    goalFlag.current = false
    return hit
  }, [])

  const reloadEmails = useCallback(async () => {
    try {
      const data = await api<{ emails: EmailRow[]; gmail: GmailState }>('/api/emails')
      setEmails(data.emails)
      setGmail(data.gmail)
    } catch {
      // Inbox shows its own error state; the rest of the app doesn't depend on it.
    }
  }, [])

  const reload = useCallback(async () => {
    try {
      const [apps, prof] = await Promise.all([
        api<{ applications: Application[] }>('/api/applications'),
        api<{ profile: Profile }>('/api/profile'),
        reloadEmails(),
      ])
      setApplications(apps.applications)
      setProfile(prof.profile)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load your data')
    } finally {
      setLoading(false)
    }
  }, [reloadEmails])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload()
  }, [reload])

  /** Celebrate when an action takes today's count across the daily minimum. */
  const checkGoal = useCallback(
    (before: Application[], after: Application[]) => {
      const min = profileRef.current?.dailyMin ?? 5
      if (todayCount(before) < min && todayCount(after) >= min) {
        goalFlag.current = true
        setCelebrate(Date.now())
        const streak = streaks(countByDay(after), min).current
        toast(`Daily minimum reached. Streak extended to ${streak} day${streak === 1 ? '' : 's'}`)
        return true
      }
      return false
    },
    [toast]
  )

  const createApplication = useCallback<AppDataValue['createApplication']>(
    async (input) => {
      goalFlag.current = false
      try {
        const { application } = await api<{ application: Application }>('/api/applications', { method: 'POST', json: input })
        const before = appsRef.current
        const after = [application, ...before]
        appsRef.current = after
        setApplications(after)
        checkGoal(before, after)
        return application
      } catch (err) {
        toast(err instanceof Error ? err.message : 'Could not save application', { error: true })
        return null
      }
    },
    [toast, checkGoal]
  )

  const updateApplication = useCallback<AppDataValue['updateApplication']>(
    async (id, input) => {
      goalFlag.current = false
      const before = appsRef.current
      const previous = before.find((a) => a.id === id)
      // Optimistic, so drags and status changes feel instant.
      setApplications((prev) => prev.map((a) => (a.id === id ? ({ ...a, ...input, updatedAt: new Date().toISOString() } as Application) : a)))
      try {
        const { application } = await api<{ application: Application }>(`/api/applications/${id}`, { method: 'PATCH', json: input })
        const after = appsRef.current.map((a) => (a.id === id ? application : a))
        appsRef.current = after
        setApplications(after)
        checkGoal(before, after)
        return application
      } catch (err) {
        if (previous) setApplications((prev) => prev.map((a) => (a.id === id ? previous : a)))
        toast(err instanceof Error ? err.message : 'Could not update application', { error: true })
        return null
      }
    },
    [toast, checkGoal]
  )

  const deleteApplication = useCallback<AppDataValue['deleteApplication']>(
    async (id) => {
      const removed = appsRef.current.find((a) => a.id === id)
      setApplications((prev) => prev.filter((a) => a.id !== id))
      try {
        await api(`/api/applications/${id}`, { method: 'DELETE' })
        setEmails((prev) => prev.filter((e) => e.applicationId !== id))
        return true
      } catch (err) {
        if (removed) setApplications((prev) => [removed, ...prev])
        toast(err instanceof Error ? err.message : 'Could not delete application', { error: true })
        return false
      }
    },
    [toast]
  )

  const setStatus = useCallback<AppDataValue['setStatus']>(
    async (app, status) => {
      if (app.status === status) return
      const prev = app.status
      const syncEmails = (s: Status) =>
        setEmails((list) => list.map((e) => (e.applicationId === app.id ? { ...e, application: { ...e.application, status: s } } : e)))
      // Toast immediately; if the save crosses the daily minimum, the goal toast replaces it.
      toast(`${app.company} moved to ${STATUS_LABEL[status]}`, {
        undo: () => {
          updateApplication(app.id, { status: prev })
          syncEmails(prev)
        },
      })
      syncEmails(status)
      if (!(await updateApplication(app.id, { status }))) syncEmails(prev)
    },
    [updateApplication, toast]
  )

  const updateProfile = useCallback<AppDataValue['updateProfile']>(
    async (input) => {
      try {
        const { profile } = await api<{ profile: Profile }>('/api/profile', { method: 'PATCH', json: input })
        setProfile(profile)
        return profile
      } catch (err) {
        toast(err instanceof Error ? err.message : 'Could not save settings', { error: true })
        return null
      }
    },
    [toast]
  )

  const openEditor = useCallback((target: Exclude<EditorTarget, null>) => setEditor(target), [])
  const closeEditor = useCallback(() => setEditor(null), [])

  const value = useMemo(
    () => ({
      applications,
      profile,
      emails,
      gmail,
      loading,
      error,
      reload,
      reloadEmails,
      createApplication,
      updateApplication,
      deleteApplication,
      setStatus,
      takeGoalFlag,
      updateProfile,
      editor,
      openEditor,
      closeEditor,
    }),
    [applications, profile, emails, gmail, loading, error, reload, reloadEmails, createApplication, updateApplication, deleteApplication, setStatus, takeGoalFlag, updateProfile, editor, openEditor, closeEditor]
  )

  return (
    <AppDataContext.Provider value={value}>
      {children}
      {celebrate > 0 && <Confetti key={celebrate} onDone={() => setCelebrate(0)} />}
    </AppDataContext.Provider>
  )
}
