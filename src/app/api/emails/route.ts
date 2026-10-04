import { prisma } from '@/lib/prisma'
import { error, getUserId, json } from '@/lib/api'
import { googleEnabled } from '@/lib/auth'

// GET /api/emails — tracked emails plus Gmail connection state
export async function GET() {
  const userId = await getUserId()
  if (!userId) return error('Unauthorized', 401)

  try {
    const [emails, google] = await Promise.all([
      prisma.email.findMany({
        where: { application: { userId } },
        include: { application: { select: { id: true, jobTitle: true, company: true, status: true } } },
        orderBy: { date: 'desc' },
        take: 300,
      }),
      prisma.account.findFirst({ where: { userId, provider: 'google' }, select: { scope: true } }),
    ])

    return json({
      emails,
      gmail: {
        available: googleEnabled,
        connected: Boolean(google?.scope?.includes('gmail.readonly')),
      },
    })
  } catch (err) {
    console.error('Error fetching emails:', err)
    return error('Failed to load emails', 500)
  }
}
