import { prisma } from '@/lib/prisma'
import { error, getUserId, json, readJson } from '@/lib/api'

// POST /api/ai/cover-letter — draft a cover letter for one job from the user's real CV.
// Falls back to the user's saved template (with {company}/{role} filled in) when no OpenAI key is set.
export async function POST(request: Request) {
  const userId = await getUserId()
  if (!userId) return error('Unauthorized', 401)

  const body = await readJson(request)
  const jobTitle = typeof body?.jobTitle === 'string' ? body.jobTitle.trim().slice(0, 200) : ''
  const company = typeof body?.company === 'string' ? body.company.trim().slice(0, 200) : ''
  const description = typeof body?.description === 'string' ? body.description.slice(0, 15000) : ''
  if (!jobTitle && !company) return error('Missing the job title and company')

  const [user, docs] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { name: true, portfolioUrl: true } }),
    prisma.userDocument.findMany({ where: { userId }, orderBy: { updatedAt: 'desc' }, select: { type: true, parsedText: true } }),
  ])
  const cv = docs.find((d) => d.type === 'cv')?.parsedText ?? ''
  const template = docs.find((d) => d.type === 'cover_letter_template')?.parsedText ?? ''

  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (apiKey && cv.length > 50) {
    try {
      const letter = await draft({ jobTitle, company, description, cv, name: user?.name ?? '', portfolio: user?.portfolioUrl ?? '' }, apiKey)
      return json({ letter, mode: 'ai' })
    } catch (err) {
      console.warn('Cover letter generation failed:', err)
    }
  }

  if (template) {
    const fill = (s: string) =>
      s
        .replace(/\{\s*company\s*\}/gi, company || 'your company')
        .replace(/\{\s*(role|job title|position)\s*\}/gi, jobTitle || 'this role')
        .replace(/\{\s*hiring manager\s*\}/gi, 'Hiring Manager')
        .replace(/\{\s*name\s*\}/gi, user?.name ?? '')
    return json({ letter: fill(template), mode: 'template' })
  }

  return error(
    cv.length > 50
      ? 'Add OPENAI_API_KEY to .env, or save a cover letter template in CV & tailoring.'
      : 'Add your CV in CV & tailoring first, so the letter can draw on your real experience.',
    422
  )
}

async function draft(p: { jobTitle: string; company: string; description: string; cv: string; name: string; portfolio: string }, apiKey: string) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0.5,
      messages: [
        {
          role: 'system',
          content: `You write cover letters for a candidate.
Rules:
- Only use facts from the candidate's CV. Never invent employers, numbers, degrees or skills.
- If the job needs something the CV doesn't show, express willingness to learn instead of claiming it.
- Under 230 words, plain and specific, no buzzwords ("passionate", "results-driven", "synergy").
- Start with "Dear Hiring Manager," unless a name is given. Sign off with the candidate's name.
- Output only the letter text.`,
        },
        {
          role: 'user',
          content: `Role: ${p.jobTitle}${p.company ? ` at ${p.company}` : ''}
Job post:
"""
${p.description || '(no description provided)'}
"""

Candidate CV:
"""
${p.cv.slice(0, 15000)}
"""
${p.name ? `Candidate name: ${p.name}\n` : ''}${p.portfolio ? `Portfolio: ${p.portfolio}\n` : ''}`,
        },
      ],
    }),
    signal: AbortSignal.timeout(45_000),
  })
  if (!res.ok) throw new Error(`OpenAI responded with ${res.status}`)
  const data = await res.json()
  const letter = data.choices?.[0]?.message?.content
  if (typeof letter !== 'string' || !letter.trim()) throw new Error('Empty response')
  return letter.trim()
}
