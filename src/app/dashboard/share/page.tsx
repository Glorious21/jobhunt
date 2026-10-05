'use client'

import { Suspense, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAppData } from '@/components/AppData'
import { PageSkeleton } from '@/components/PageState'

// Share target: Android sends shared text here (?title=&text=&url=). We open
// "Add application" with the post, which parses it straight away, on the Overview.
export default function SharePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Share />
    </Suspense>
  )
}

function Share() {
  const params = useSearchParams()
  const router = useRouter()
  const { openEditor } = useAppData()
  const done = useRef(false)

  useEffect(() => {
    if (done.current) return
    done.current = true
    const title = params.get('title') ?? ''
    const text = params.get('text') ?? ''
    const url = params.get('url') ?? ''
    // The share "title" is often just the app or chat name ("WhatsApp"), so it's only used when
    // there's no text. Apps differ on where the link goes (`url` or inside `text`); don't duplicate it.
    const post = [text || title, url && !text.includes(url) ? url : ''].filter(Boolean).join('\n').trim()
    router.replace('/dashboard')
    if (post) openEditor({ post })
  }, [params, router, openEditor])

  return <PageSkeleton />
}
