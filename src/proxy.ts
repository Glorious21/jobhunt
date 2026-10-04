import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Optimistic check only: sends visitors without a session cookie to /login.
// Real authorization happens in the dashboard layout and every API route.
// (/login itself decides server-side whether the session is real, so a stale
// cookie can never hide the login page.)
const SESSION_COOKIES = ['authjs.session-token', '__Secure-authjs.session-token']

export function proxy(request: NextRequest) {
  const hasSession = SESSION_COOKIES.some((name) => request.cookies.has(name))
  if (!hasSession) {
    const { pathname, search } = request.nextUrl
    const url = new URL('/login', request.url)
    url.searchParams.set('next', pathname + search)
    return NextResponse.redirect(url)
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/onboarding'],
}
