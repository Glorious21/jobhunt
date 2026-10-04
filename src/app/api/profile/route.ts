import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { error, getUserId, json, optString, readJson } from '@/lib/api'

async function loadProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { accounts: { select: { provider: true } } },
  })
  if (!user) return null
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
    isDemo: user.isDemo,
    onboarded: user.onboarded,
    targetRole: user.targetRole,
    targetLocation: user.targetLocation,
    dailyMin: user.dailyMin,
    dailyMax: user.dailyMax,
    portfolioUrl: user.portfolioUrl,
    hasPassword: Boolean(user.password),
    providers: user.accounts.map((a) => a.provider),
    gmailSyncedAt: user.gmailSyncedAt,
    phone: user.phone,
    linkedinUrl: user.linkedinUrl,
    githubUrl: user.githubUrl,
  }
}

export async function GET() {
  const userId = await getUserId()
  if (!userId) return error('Unauthorized', 401)
  const profile = await loadProfile(userId)
  if (!profile) return error('User not found', 404)
  return json({ profile })
}

export async function PATCH(request: Request) {
  const userId = await getUserId()
  if (!userId) return error('Unauthorized', 401)
  const body = await readJson(request)
  if (!body) return error('Invalid request body')

  const data: Prisma.UserUpdateInput = {}
  const name = optString(body.name, 80)
  if (name !== undefined) data.name = name
  for (const key of ['targetRole', 'targetLocation'] as const) {
    const v = optString(body[key], 120)
    if (v !== undefined) data[key] = v
  }
  for (const key of ['portfolioUrl', 'linkedinUrl', 'githubUrl'] as const) {
    const v = optString(body[key], 500)
    if (v !== undefined) data[key] = v
  }
  const phone = optString(body.phone, 40)
  if (phone !== undefined) data.phone = phone
  if (body.onboarded === true) data.onboarded = true

  if (body.dailyMin !== undefined || body.dailyMax !== undefined) {
    const min = Number(body.dailyMin)
    const max = Number(body.dailyMax)
    if (!Number.isInteger(min) || !Number.isInteger(max) || min < 1 || max > 50 || min > max) {
      return error('Daily target must be whole numbers between 1 and 50, with min ≤ max')
    }
    data.dailyMin = min
    data.dailyMax = max
  }

  try {
    await prisma.user.update({ where: { id: userId }, data })
    return json({ profile: await loadProfile(userId) })
  } catch (err) {
    console.error('Profile update error:', err)
    return error('Failed to save settings', 500)
  }
}

// DELETE /api/profile — permanently delete the account and all its data
export async function DELETE() {
  const userId = await getUserId({ sessionOnly: true })
  if (!userId) return error('Unauthorized', 401)
  try {
    const appIds = (await prisma.application.findMany({ where: { userId }, select: { id: true } })).map((a) => a.id)
    await prisma.email.deleteMany({ where: { applicationId: { in: appIds } } })
    await prisma.application.deleteMany({ where: { userId } })
    await prisma.userDocument.deleteMany({ where: { userId } })
    await prisma.account.deleteMany({ where: { userId } })
    await prisma.session.deleteMany({ where: { userId } })
    await prisma.user.delete({ where: { id: userId } })
    return json({ success: true })
  } catch (err) {
    console.error('Account deletion error:', err)
    return error('Failed to delete account', 500)
  }
}
