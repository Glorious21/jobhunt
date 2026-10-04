import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { error, getUserId, json, readJson } from '@/lib/api'

// POST /api/profile/password — change (or set, for OAuth-only accounts) the password
export async function POST(request: Request) {
  const userId = await getUserId({ sessionOnly: true })
  if (!userId) return error('Unauthorized', 401)

  const body = await readJson(request)
  const current = typeof body?.current === 'string' ? body.current : ''
  const next = typeof body?.next === 'string' ? body.next : ''
  if (next.length < 8) return error('New password must be at least 8 characters')
  if (next.length > 200) return error('Password is too long')

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { password: true, isDemo: true } })
  if (!user) return error('User not found', 404)
  if (user.isDemo) return error('Demo workspaces can’t set a password. Create your own account instead.', 403)

  if (user.password) {
    const ok = current ? await bcrypt.compare(current, user.password) : false
    if (!ok) return error('Current password is incorrect', 403)
  }

  await prisma.user.update({ where: { id: userId }, data: { password: await bcrypt.hash(next, 10) } })
  return json({ success: true })
}
