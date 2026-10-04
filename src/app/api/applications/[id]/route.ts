import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { error, getUserId, json, OBJECT_ID, optDate, optString, readJson } from '@/lib/api'
import { isSource, isStatus, REPLY_STATUSES, SENT_STATUSES } from '@/lib/constants'

interface RouteParams {
  params: Promise<{ id: string }>
}

async function findOwned(id: string, userId: string) {
  if (!OBJECT_ID.test(id)) return null
  return prisma.application.findFirst({ where: { id, userId } })
}

// PATCH /api/applications/[id]
export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params
  const userId = await getUserId()
  if (!userId) return error('Unauthorized', 401)

  const existing = await findOwned(id, userId)
  if (!existing) return error('Application not found', 404)

  const body = await readJson(request)
  if (!body) return error('Invalid request body')

  const data: Prisma.ApplicationUpdateInput = {}

  if (body.status !== undefined) {
    if (!isStatus(body.status)) return error('Invalid status')
    data.status = body.status
    // Fill in milestone dates the first time a status is reached.
    if (SENT_STATUSES.includes(body.status) && !existing.appliedAt) data.appliedAt = new Date()
    if (REPLY_STATUSES.includes(body.status) && !existing.respondedAt) data.respondedAt = new Date()
  }
  if (body.source !== undefined) {
    if (!isSource(body.source)) return error('Invalid source')
    data.source = body.source
  }

  const jobTitle = optString(body.jobTitle, 200)
  const company = optString(body.company, 200)
  if (body.jobTitle !== undefined && !jobTitle) return error('Job title cannot be empty')
  if (body.company !== undefined && !company) return error('Company cannot be empty')
  if (jobTitle) data.jobTitle = jobTitle
  if (company) data.company = company

  const strings = {
    location: 200,
    salary: 100,
    jobUrl: 2000,
    description: 20000,
    jobType: 50,
    notes: 10000,
    resumeUsed: 20000,
    coverLetterUsed: 20000,
    interviewType: 100,
  } as const
  for (const [key, max] of Object.entries(strings)) {
    const v = optString(body[key], max)
    if (v !== undefined) (data as Record<string, unknown>)[key] = v
  }

  if (typeof body.remote === 'boolean') data.remote = body.remote

  for (const key of ['appliedAt', 'respondedAt', 'interviewAt', 'deadline'] as const) {
    const v = optDate(body[key])
    if (v !== undefined) data[key] = v
  }

  try {
    const application = await prisma.application.update({
      where: { id },
      data,
      include: { emails: { orderBy: { date: 'desc' } } },
    })
    return json({ application })
  } catch (err) {
    console.error('Error updating application:', err)
    return error('Failed to update application', 500)
  }
}

// DELETE /api/applications/[id]
export async function DELETE(_request: Request, { params }: RouteParams) {
  const { id } = await params
  const userId = await getUserId()
  if (!userId) return error('Unauthorized', 401)
  if (!OBJECT_ID.test(id)) return error('Application not found', 404)

  try {
    // Mongo has no FK cascade, so remove dependent emails explicitly.
    const owned = await findOwned(id, userId)
    if (!owned) return error('Application not found', 404)
    await prisma.email.deleteMany({ where: { applicationId: id } })
    await prisma.application.delete({ where: { id } })
    return json({ success: true })
  } catch (err) {
    console.error('Error deleting application:', err)
    return error('Failed to delete application', 500)
  }
}
