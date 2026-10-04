import { error, getUserId, json, readJson } from '@/lib/api'
import { parseJobPost, type ParsedJob } from '@/lib/job-post'

const MAX_TEXT = 20000

// POST /api/jobs/parse — turn a pasted job post into application fields.
// Heuristics always run; with OPENAI_API_KEY set, the model fills gaps the heuristics missed.
export async function POST(request: Request) {
  const userId = await getUserId()
  if (!userId) return error('Unauthorized', 401)

  const body = await readJson(request)
  const text = typeof body?.text === 'string' ? body.text.slice(0, MAX_TEXT) : ''
  if (text.trim().length < 20) return error('Paste the full job post')

  const job = parseJobPost(text)
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (apiKey && (!job.company || !job.jobTitle || !job.location)) {
    try {
      const ai = await extractWithAI(text, apiKey)
      for (const key of ['company', 'jobTitle', 'location', 'jobType', 'salary'] as const) {
        if (!job[key] && typeof ai[key] === 'string' && ai[key]) job[key] = (ai[key] as string).slice(0, 200)
      }
    } catch (err) {
      console.warn('AI job extraction failed; using heuristics only:', err)
    }
  }
  return json({ job })
}

async function extractWithAI(text: string, apiKey: string): Promise<Partial<Record<keyof ParsedJob, unknown>>> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'Extract job details from the post. Use only what the post states; use null when unknown. Respond with JSON: {"company": string|null, "jobTitle": string|null, "location": string|null, "jobType": string|null, "salary": string|null}',
        },
        { role: 'user', content: text },
      ],
    }),
    signal: AbortSignal.timeout(20_000),
  })
  if (!res.ok) throw new Error(`OpenAI responded with ${res.status}`)
  const data = await res.json()
  return JSON.parse(data.choices?.[0]?.message?.content ?? '{}')
}
