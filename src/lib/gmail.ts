import { prisma } from '@/lib/prisma'

export class GmailNotConnected extends Error {}

/** Returns a valid Gmail access token for the user, refreshing it if needed. */
export async function getGmailAccessToken(userId: string): Promise<{ token: string; scope: string | null }> {
  const account = await prisma.account.findFirst({ where: { userId, provider: 'google' } })
  if (!account?.access_token) throw new GmailNotConnected('Google account not connected')
  if (!account.scope?.includes('gmail.readonly')) throw new GmailNotConnected('Gmail permission not granted')

  const expiresSoon = !account.expires_at || account.expires_at * 1000 < Date.now() + 60_000
  if (!expiresSoon) return { token: account.access_token, scope: account.scope }

  if (!account.refresh_token) throw new GmailNotConnected('Google session expired — reconnect Gmail')

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: 'refresh_token',
      refresh_token: account.refresh_token,
    }),
  })
  if (!res.ok) throw new GmailNotConnected('Google session expired — reconnect Gmail')
  const data = (await res.json()) as { access_token: string; expires_in: number; refresh_token?: string }

  await prisma.account.update({
    where: { id: account.id },
    data: {
      access_token: data.access_token,
      expires_at: Math.floor(Date.now() / 1000) + data.expires_in,
      ...(data.refresh_token ? { refresh_token: data.refresh_token } : {}),
    },
  })
  return { token: data.access_token, scope: account.scope }
}

async function gmail<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15_000),
  })
  if (res.status === 401) throw new GmailNotConnected('Google session expired — reconnect Gmail')
  if (!res.ok) throw new Error(`Gmail API ${res.status}`)
  return res.json() as Promise<T>
}

export interface GmailMessage {
  id: string
  threadId: string
  snippet: string
  subject: string
  from: string
  to: string
  date: Date | null
  labels: string[]
}

export async function searchMessages(token: string, q: string, max = 10): Promise<GmailMessage[]> {
  const list = await gmail<{ messages?: { id: string }[] }>(
    token,
    `messages?${new URLSearchParams({ q, maxResults: String(max) })}`
  )
  const ids = list.messages?.map((m) => m.id) ?? []
  const messages = await Promise.all(
    ids.map((id) =>
      gmail<{
        id: string
        threadId: string
        snippet: string
        labelIds?: string[]
        internalDate?: string
        payload?: { headers?: { name: string; value: string }[] }
      }>(token, `messages/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=To`)
    )
  )
  return messages.map((m) => {
    const header = (name: string) => m.payload?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? ''
    return {
      id: m.id,
      threadId: m.threadId,
      snippet: decodeEntities(m.snippet ?? ''),
      subject: header('Subject'),
      from: header('From'),
      to: header('To'),
      date: m.internalDate ? new Date(Number(m.internalDate)) : null,
      labels: m.labelIds ?? [],
    }
  })
}

function decodeEntities(s: string) {
  return s
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

const RULES: [string, RegExp][] = [
  ['offer', /\b(offer letter|pleased to offer|delighted to offer|job offer|extend an offer)\b/i],
  ['rejection', /\b(not (to )?(move|moving) forward|unfortunately|other candidates|not been successful|decided not to proceed|position has been filled|will not be progressing)\b/i],
  ['interview', /\b(interview|schedule a (call|chat)|availability|calendly|phone screen|technical (round|assessment)|next steps?)\b/i],
  ['confirmation', /\b(received your application|thank(s| you) for (applying|your application|your interest))\b/i],
]

export function categorize(subject: string, snippet: string): string {
  const text = `${subject}\n${snippet}`
  for (const [category, re] of RULES) if (re.test(text)) return category
  return 'reply'
}
