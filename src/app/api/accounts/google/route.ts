import { prisma } from '@/lib/prisma'
import { error, getUserId, json } from '@/lib/api'

// DELETE /api/accounts/google — disconnect Google / Gmail
export async function DELETE() {
  const userId = await getUserId({ sessionOnly: true })
  if (!userId) return error('Unauthorized', 401)

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { password: true, accounts: { select: { id: true, provider: true } } },
  })
  if (!user) return error('User not found', 404)

  const google = user.accounts.find((a) => a.provider === 'google')
  if (!google) return error('Google isn’t connected', 404)

  // Don't strand the user: they need another way to sign in.
  const otherLogin = Boolean(user.password) || user.accounts.some((a) => a.provider !== 'google')
  if (!otherLogin) return error('Set a password first. Google is currently your only way to sign in.', 409)

  await prisma.account.delete({ where: { id: google.id } })
  await prisma.user.update({ where: { id: userId }, data: { gmailSyncedAt: null } })
  return json({ success: true })
}
