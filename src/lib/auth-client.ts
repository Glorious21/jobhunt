'use client'

import { signIn } from 'next-auth/react'

// On a first visit, the parallel Auth.js requests fired during page load each set
// a fresh CSRF cookie, so a click in that first moment can send a stale token.
// The cookie is settled by the time the request fails, so one retry is enough.
export async function credentialsSignIn(provider: 'credentials' | 'demo', options: Record<string, unknown> = {}) {
  const res = await signIn(provider, { ...options, redirect: false })
  if (res?.error === 'MissingCSRF') return signIn(provider, { ...options, redirect: false })
  return res
}
