import { prisma } from '@/lib/prisma'
import { error, getUserId, json } from '@/lib/api'
import { categorize, getGmailAccessToken, GmailNotConnected, searchMessages } from '@/lib/gmail'

const MAX_COMPANIES = 30

// POST /api/emails/sync — pull recent Gmail messages that mention tracked companies
export async function POST() {
  const userId = await getUserId()
  if (!userId) return error('Unauthorized', 401)

  let token: string
  try {
    token = (await getGmailAccessToken(userId)).token
  } catch (err) {
    if (err instanceof GmailNotConnected) return error(err.message, 409)
    throw err
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } })
  const myEmail = user?.email?.toLowerCase() ?? ''

  // Most recently applied application per company.
  const apps = await prisma.application.findMany({
    where: { userId, status: { not: 'SAVED' } },
    orderBy: { appliedAt: 'desc' },
    select: { id: true, company: true, appliedAt: true },
  })
  const byCompany = new Map<string, { id: string; appliedAt: Date | null }>()
  for (const a of apps) if (!byCompany.has(a.company)) byCompany.set(a.company, a)
  const companies = [...byCompany.entries()].slice(0, MAX_COMPANIES)

  let added = 0
  let scanned = 0
  try {
    for (const [company, app] of companies) {
      const since = app.appliedAt ? Math.max(1, Math.ceil((Date.now() - app.appliedAt.getTime()) / 86_400_000) + 2) : 60
      const q = `"${company.replace(/"/g, '')}" newer_than:${Math.min(since, 180)}d -in:sent -in:chats -category:promotions`
      const messages = await searchMessages(token, q, 8)
      scanned += messages.length
      if (!messages.length) continue

      const existing = await prisma.email.findMany({
        where: { gmailMessageId: { in: messages.map((m) => m.id) } },
        select: { gmailMessageId: true },
      })
      const known = new Set(existing.map((e) => e.gmailMessageId))
      const fresh = messages.filter((m) => !known.has(m.id))
      if (!fresh.length) continue

      await prisma.email.createMany({
        data: fresh.map((m) => ({
          applicationId: app.id,
          gmailMessageId: m.id,
          threadId: m.threadId,
          subject: m.subject.slice(0, 500),
          snippet: m.snippet.slice(0, 1000),
          from: m.from.slice(0, 300),
          to: m.to.slice(0, 300),
          date: m.date,
          isResponse: !m.from.toLowerCase().includes(myEmail || '\u0000'),
          category: categorize(m.subject, m.snippet),
          labels: m.labels,
        })),
      })
      added += fresh.length
    }
  } catch (err) {
    if (err instanceof GmailNotConnected) return error(err.message, 409)
    console.error('Gmail sync failed:', err)
    return error('Gmail sync failed. Try again shortly.', 502)
  }

  await prisma.user.update({ where: { id: userId }, data: { gmailSyncedAt: new Date() } })
  return json({ added, scanned, companies: companies.length })
}
