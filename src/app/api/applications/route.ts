import { prisma } from '@/lib/prisma'
import { error, getUserId, json, optDate, optString, readJson } from '@/lib/api'
import { isSource, isStatus, SENT_STATUSES, REPLY_STATUSES } from '@/lib/constants'

// GET /api/applications — every application for the current user
export async function GET(request: Request) {
  const userId = await getUserId()
  if (!userId) return error('Unauthorized', 401)

  // ?url= finds applications for a job page (used by the browser extension).
  const url = new URL(request.url).searchParams.get('url')
  if (url) {
    const key = urlKey(url)
    if (!key) return json({ applications: [] })
    const candidates = await prisma.application.findMany({
      where: { userId, jobUrl: { not: null } },
      orderBy: { updatedAt: 'desc' },
      take: 500,
    })
    return json({ applications: candidates.filter((a) => urlKey(a.jobUrl!) === key) })
  }

  try {
    const applications = await prisma.application.findMany({
      where: { userId },
      include: { emails: { orderBy: { date: 'desc' } } },
      orderBy: { createdAt: 'desc' },
    })
    return json({ applications })
  } catch (err) {
    console.error('Error fetching applications:', err)
    return error('Failed to load applications', 500)
  }
}

// POST /api/applications — create an application
export async function POST(request: Request) {
  const userId = await getUserId()
  if (!userId) return error('Unauthorized', 401)

  const body = await readJson(request)
  if (!body) return error('Invalid request body')

  const jobTitle = optString(body.jobTitle, 200)
  const company = optString(body.company, 200)
  if (!jobTitle || !company) return error('Job title and company are required')

  if (body.status !== undefined && !isStatus(body.status)) return error('Invalid status')
  if (body.source !== undefined && !isSource(body.source)) return error('Invalid source')
  const status = isStatus(body.status) ? body.status : 'SAVED'
  const source = isSource(body.source) ? body.source : 'MANUAL'
  const now = new Date()

  try {
    const application = await prisma.application.create({
      data: {
        userId,
        jobTitle,
        company,
        status,
        source,
        location: optString(body.location, 200) ?? null,
        salary: optString(body.salary, 100) ?? null,
        jobUrl: optString(body.jobUrl, 2000) ?? null,
        description: optString(body.description, 20000) ?? null,
        jobType: optString(body.jobType, 50) ?? null,
        remote: body.remote === true,
        notes: optString(body.notes, 10000) ?? null,
        appliedAt: optDate(body.appliedAt) ?? (SENT_STATUSES.includes(status) ? now : null),
        respondedAt: optDate(body.respondedAt) ?? (REPLY_STATUSES.includes(status) ? now : null),
        interviewAt: optDate(body.interviewAt) ?? null,
        interviewType: optString(body.interviewType, 100) ?? null,
        deadline: optDate(body.deadline) ?? null,
      },
      include: { emails: true },
    })
    return json({ application }, 201)
  } catch (err) {
    console.error('Error creating application:', err)
    return error('Failed to create application', 500)
  }
}

/** host + path without trailing slash, query or hash — matches the same posting across tracking params. */
function urlKey(raw: string) {
  try {
    const u = new URL(raw)
    return `${u.hostname.replace(/^www\./, '')}${u.pathname.replace(/\/+$/, '')}`.toLowerCase()
  } catch {
    return null
  }
}
