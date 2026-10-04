import { createHash, randomBytes } from 'crypto'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export function json<T>(data: T, status = 200) {
  return NextResponse.json(data, { status })
}

export function error(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

export const TOKEN_PREFIX = 'jh_'

export function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export function newToken() {
  return TOKEN_PREFIX + randomBytes(24).toString('base64url')
}

/**
 * Returns the caller's user id, or null.
 * Accepts the browser session, or a personal access token (`Authorization: Bearer jh_…`)
 * used by the browser extension — unless `sessionOnly` is set for sensitive routes.
 */
export async function getUserId(opts: { sessionOnly?: boolean } = {}): Promise<string | null> {
  if (!opts.sessionOnly) {
    const authz = (await headers()).get('authorization')
    const token = authz?.match(/^Bearer\s+(jh_[A-Za-z0-9_-]{20,})$/)?.[1]
    if (token) {
      const record = await prisma.apiToken.findUnique({ where: { tokenHash: hashToken(token) }, select: { id: true, userId: true, lastUsedAt: true } })
      if (!record) return null
      // Throttle the write to once a minute.
      if (!record.lastUsedAt || Date.now() - record.lastUsedAt.getTime() > 60_000) {
        await prisma.apiToken.update({ where: { id: record.id }, data: { lastUsedAt: new Date() } })
      }
      return record.userId
    }
  }
  const session = await auth()
  return session?.user?.id ?? null
}

export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json()
    return body && typeof body === 'object' && !Array.isArray(body) ? body : null
  } catch {
    return null
  }
}

/** Trimmed string or null; undefined when the key was absent (for PATCH semantics). */
export function optString(v: unknown, max = 5000): string | null | undefined {
  if (v === undefined) return undefined
  if (v === null) return null
  if (typeof v !== 'string') return undefined
  const t = v.trim().slice(0, max)
  return t.length ? t : null
}

export function optDate(v: unknown): Date | null | undefined {
  if (v === undefined) return undefined
  if (v === null || v === '') return null
  if (typeof v !== 'string' && typeof v !== 'number') return undefined
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? undefined : d
}

export const OBJECT_ID = /^[a-f0-9]{24}$/i
