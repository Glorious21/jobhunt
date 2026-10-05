import { prisma } from '@/lib/prisma'
import { error, getUserId, hashToken, json, newToken, OBJECT_ID, optString, readJson } from '@/lib/api'

const MAX_TOKENS = 10

// Tokens can only be managed from a signed-in browser session, never with another token.

// GET /api/tokens — list (never returns the secret)
export async function GET() {
  const userId = await getUserId({ sessionOnly: true })
  if (!userId) return error('Unauthorized', 401)
  const tokens = await prisma.apiToken.findMany({
    where: { userId },
    select: { id: true, name: true, prefix: true, lastUsedAt: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  })
  return json({ tokens })
}

// POST /api/tokens — create; the plain token is returned exactly once
export async function POST(request: Request) {
  const userId = await getUserId({ sessionOnly: true })
  if (!userId) return error('Unauthorized', 401)
  const body = await readJson(request)
  const name = optString(body?.name, 60) ?? 'Browser extension'

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { isDemo: true } })
  if (user?.isDemo) return error('Demo workspaces can’t use the browser extension. Create your own account first.', 403)

  if ((await prisma.apiToken.count({ where: { userId } })) >= MAX_TOKENS) {
    return error(`You can have up to ${MAX_TOKENS} tokens. Revoke one first.`, 409)
  }

  const token = newToken()
  const record = await prisma.apiToken.create({
    data: { userId, name, tokenHash: hashToken(token), prefix: token.slice(0, 8) },
    select: { id: true, name: true, prefix: true, lastUsedAt: true, createdAt: true },
  })
  return json({ token, record }, 201)
}

// DELETE /api/tokens?id= — revoke
export async function DELETE(request: Request) {
  const userId = await getUserId({ sessionOnly: true })
  if (!userId) return error('Unauthorized', 401)
  const id = new URL(request.url).searchParams.get('id') ?? ''
  if (!OBJECT_ID.test(id)) return error('Token not found', 404)
  const result = await prisma.apiToken.deleteMany({ where: { id, userId } })
  if (!result.count) return error('Token not found', 404)
  return json({ success: true })
}
