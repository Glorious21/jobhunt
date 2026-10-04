'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { credentialsSignIn } from '@/lib/auth-client'
import { useToast } from '@/components/Toast'

/** Starts a private demo workspace (fresh account with sample data). */
export default function DemoButton({ className, children }: { className?: string; children: React.ReactNode }) {
  const router = useRouter()
  const { toast } = useToast()
  const [busy, setBusy] = useState(false)

  const start = async () => {
    setBusy(true)
    const res = await credentialsSignIn('demo')
    if (!res || res.error) {
      setBusy(false)
      toast('Could not start the demo. Is the database reachable?', { error: true })
      return
    }
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <button className={className} onClick={start} disabled={busy} aria-busy={busy}>
      {busy ? 'Opening demo…' : children}
    </button>
  )
}
