'use client'

import { useSyncExternalStore } from 'react'

export type Theme = 'system' | 'light' | 'dark'

const listeners = new Set<() => void>()

function read(): Theme {
  try {
    const t = localStorage.getItem('theme')
    return t === 'system' || t === 'dark' ? t : 'light'
  } catch {
    return 'light'
  }
}

export function setTheme(theme: Theme) {
  try {
    if (theme === 'light') localStorage.removeItem('theme')
    else localStorage.setItem('theme', theme)
  } catch {}
  document.documentElement.dataset.theme = theme
  listeners.forEach((l) => l())
}

export function useTheme(): Theme {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    read,
    () => 'light'
  )
}
