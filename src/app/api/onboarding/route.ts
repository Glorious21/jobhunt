import { prisma } from '@/lib/prisma'
import { error, getUserId, json, optString, readJson } from '@/lib/api'
import { extractSkills } from '@/lib/skills'

export async function POST(request: Request) {
  const userId = await getUserId()
  if (!userId) return error('Unauthorized', 401)

  const body = await readJson(request)
  if (!body) return error('Invalid request body')

  const dailyMin = Number(body.dailyMin ?? 5)
  const dailyMax = Number(body.dailyMax ?? 10)
  if (!Number.isInteger(dailyMin) || !Number.isInteger(dailyMax) || dailyMin < 1 || dailyMax > 50 || dailyMin > dailyMax) {
    return error('Daily target must be whole numbers between 1 and 50, with min ≤ max')
  }

  const cvText = optString(body.cvText, 50000)

  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        ...(optString(body.name, 80) ? { name: optString(body.name, 80)! } : {}),
        targetRole: optString(body.targetRole, 120) ?? null,
        targetLocation: optString(body.targetLocation, 120) ?? null,
        portfolioUrl: optString(body.portfolioUrl, 500) ?? null,
        dailyMin,
        dailyMax,
        onboarded: true,
      },
    })

    let documentId: string | null = null
    if (cvText && cvText.length > 30) {
      const doc = await prisma.userDocument.create({
        data: {
          userId,
          type: 'cv',
          fileName: optString(body.cvFileName, 200) ?? 'Master CV',
          parsedText: cvText,
          skills: extractSkills(cvText),
          experience: [],
        },
        select: { id: true },
      })
      documentId = doc.id
    }

    return json({ success: true, documentId })
  } catch (err) {
    console.error('Onboarding error:', err)
    return error('Failed to save your setup', 500)
  }
}
