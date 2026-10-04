import { NextResponse } from 'next/server'

const SESSION_COOKIES = ['authjs.session-token', '__Secure-authjs.session-token', 'authjs.callback-url', '__Secure-authjs.callback-url']

// GET /api/session/clear — drops a session cookie that no longer maps to an account
// (deleted user, other database) and goes to the login page.
export function GET(request: Request) {
  const res = NextResponse.redirect(new URL('/login', request.url))
  for (const name of SESSION_COOKIES) res.cookies.set(name, '', { path: '/', maxAge: 0 })
  return res
}
