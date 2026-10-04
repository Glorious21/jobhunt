'use client'

import { createContext, useCallback, useContext, useRef, useState } from 'react'

interface ToastAction {
  label: string
  onClick: () => void
}

interface ToastState {
  id: number
  message: string
  error?: boolean
  action?: ToastAction
}

interface ToastOptions {
  undo?: () => void
  /** A lime action button other than Undo, e.g. "Mark applied". */
  action?: ToastAction
  error?: boolean
  /** ms; defaults to 5000 */
  duration?: number
}

const ToastContext = createContext<{ toast: (message: string, opts?: ToastOptions) => void }>({ toast: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

/** One toast at a time: dark pill, bottom centre, optional lime Undo, hides after 5s. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [current, setCurrent] = useState<ToastState | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const nextId = useRef(1)

  const toast = useCallback((message: string, opts?: ToastOptions) => {
    if (timer.current) clearTimeout(timer.current)
    const action = opts?.action ?? (opts?.undo ? { label: 'Undo', onClick: opts.undo } : undefined)
    setCurrent({ id: nextId.current++, message, error: opts?.error, action })
    timer.current = setTimeout(() => setCurrent(null), opts?.duration ?? 5000)
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div role="status" aria-live="polite">
        {current && (
          <div key={current.id} className="toast" data-type={current.error ? 'error' : undefined}>
            <span>{current.message}</span>
            {current.action && (
              <button
                className="btn btn-lime btn-xs"
                onClick={() => {
                  current.action!.onClick()
                  setCurrent(null)
                }}
              >
                {current.action.label}
              </button>
            )}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  )
}
