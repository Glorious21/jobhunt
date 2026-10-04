import { prisma } from '@/lib/prisma'
import { error, getUserId, json, readJson } from '@/lib/api'
import { compareSkills } from '@/lib/skills'
import type { TailorResult } from '@/lib/types'

const MAX_CV = 20000
const MAX_JD = 15000

export async function POST(request: Request) {
  const userId = await getUserId()
  if (!userId) return error('Unauthorized', 401)

  const body = await readJson(request)
  const jobTitle = typeof body?.jobTitle === 'string' ? body.jobTitle.trim().slice(0, 200) : ''
  const company = typeof body?.company === 'string' ? body.company.trim().slice(0, 200) : ''
  const jobDescription = typeof body?.jobDescription === 'string' ? body.jobDescription.slice(0, MAX_JD) : ''
  const cvText = typeof body?.cvText === 'string' ? body.cvText.slice(0, MAX_CV) : ''

  if (!jobTitle) return error('Add the job title')
  if (cvText.trim().length < 50) return error('Your CV text is too short to analyse')
  if (jobDescription.trim().length < 50) return error('Paste the job description so there is something to match against')

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { portfolioUrl: true, name: true } })
  const keywords = compareSkills(cvText, `${jobTitle}\n${jobDescription}`)

  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (apiKey) {
    try {
      const ai = await callOpenAI({ jobTitle, company, jobDescription, cvText, portfolioUrl: user?.portfolioUrl ?? null, name: user?.name ?? null }, apiKey)
      const result: TailorResult = {
        mode: 'ai',
        matchScore: clampScore(ai.matchScore, keywords.score),
        matchingSkills: strings(ai.matchingSkills) ?? keywords.matching,
        missingSkills: strings(ai.missingSkills) ?? keywords.missing,
        tailoredSummary: typeof ai.tailoredSummary === 'string' ? ai.tailoredSummary : undefined,
        tailoredBulletPoints: strings(ai.tailoredBulletPoints),
        coverLetter: typeof ai.coverLetter === 'string' ? ai.coverLetter : undefined,
        inMailPitch: typeof ai.inMailPitch === 'string' ? ai.inMailPitch : undefined,
        interviewTips: strings(ai.interviewTips),
      }
      return json({ result })
    } catch (err) {
      console.warn('OpenAI call failed, returning keyword analysis only:', err)
    }
  }

  const result: TailorResult = {
    mode: 'keywords',
    matchScore: keywords.score,
    matchingSkills: keywords.matching,
    missingSkills: keywords.missing,
  }
  return json({ result })
}

function strings(v: unknown): string[] | undefined {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : undefined
}

function clampScore(v: unknown, fallback: number) {
  const n = Number(v)
  return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : fallback
}

interface Payload {
  jobTitle: string
  company: string
  jobDescription: string
  cvText: string
  portfolioUrl: string | null
  name: string | null
}

async function callOpenAI(p: Payload, apiKey: string): Promise<Record<string, unknown>> {
  const system = `You are an experienced recruiter and CV editor. You help a candidate tailor their application to one job.
Rules:
- Only use facts present in the candidate's CV. Never invent employers, numbers, metrics, degrees or skills.
- If the CV lacks something the job needs, list it under missingSkills instead of claiming it.
- Write in plain, specific language. Avoid buzzwords like "results-driven", "passionate", "synergy".
- Respond with JSON only.`

  const user = `Job: ${p.jobTitle}${p.company ? ` at ${p.company}` : ''}

Job description:
"""
${p.jobDescription}
"""

Candidate CV:
"""
${p.cvText}
"""
${p.portfolioUrl ? `Portfolio: ${p.portfolioUrl}\n` : ''}${p.name ? `Candidate name: ${p.name}\n` : ''}
Return a JSON object with:
{
  "matchScore": integer 0-100 (how well the CV evidences the job's requirements),
  "matchingSkills": string[] (requirements the CV clearly shows),
  "missingSkills": string[] (requirements the CV does not show),
  "tailoredSummary": string (3 sentences, first person omitted, for the top of the CV),
  "tailoredBulletPoints": string[] (4-6 rewrites of EXISTING CV bullets, reordered for relevance),
  "coverLetter": string (under 250 words, signed with the candidate's name if known),
  "inMailPitch": string (under 60 words, for messaging a recruiter),
  "interviewTips": string[] (3 specific things to prepare for this role)
}`

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.4,
      response_format: { type: 'json_object' },
    }),
    signal: AbortSignal.timeout(45_000),
  })

  if (!res.ok) throw new Error(`OpenAI responded with ${res.status}`)
  const data = await res.json()
  const content = data.choices?.[0]?.message?.content
  if (typeof content !== 'string') throw new Error('Empty OpenAI response')
  return JSON.parse(content)
}
