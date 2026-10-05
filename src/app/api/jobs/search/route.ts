import { error, getUserId, json } from '@/lib/api'
import type { JobListing } from '@/lib/types'
import type { Source } from '@/lib/constants'

// Job search aggregator — JSearch (RapidAPI, aggregates LinkedIn/Indeed/Glassdoor…) + Adzuna.
// Returns sample listings, clearly flagged, only when no provider is configured.

const ADZUNA_COUNTRIES = ['gb', 'us', 'ca', 'au', 'de', 'fr', 'in', 'nl', 'nz', 'pl', 'sg', 'za', 'br', 'it', 'es', 'at', 'be', 'ch', 'mx']

// Location text → ISO country code. JSearch searches one country's index (default US), so
// "Lagos" must be sent as country=ng; Adzuna only covers the countries listed above.
const COUNTRY_HINTS: [RegExp, string][] = [
  [/nigeria|lagos|abuja|ikeja|lekki|port harcourt|ibadan|kano|enugu|benin city|kaduna|abeokuta|owerri|uyo|calabar|\bjos\b|ilorin|warri|akure/i, 'ng'],
  [/ghana|accra|kumasi/i, 'gh'],
  [/kenya|nairobi|mombasa/i, 'ke'],
  [/south africa|johannesburg|cape town|durban|pretoria/i, 'za'],
  [/rwanda|kigali/i, 'rw'],
  [/egypt|cairo/i, 'eg'],
  [/united kingdom|\buk\b|england|london|manchester|birmingham|edinburgh|glasgow|leeds|bristol/i, 'gb'],
  [/ireland|dublin/i, 'ie'],
  [/germany|berlin|munich|hamburg/i, 'de'],
  [/netherlands|amsterdam|rotterdam/i, 'nl'],
  [/france|paris/i, 'fr'],
  [/spain|madrid|barcelona/i, 'es'],
  [/portugal|lisbon/i, 'pt'],
  [/canada|toronto|vancouver|montreal/i, 'ca'],
  [/india|bangalore|bengaluru|mumbai|delhi|hyderabad|pune/i, 'in'],
  [/australia|sydney|melbourne/i, 'au'],
  [/dubai|abu dhabi|united arab emirates|\buae\b/i, 'ae'],
  [/united states|\busa?\b|new york|san francisco|seattle|austin|chicago|boston|los angeles/i, 'us'],
]

function countryFor(location: string, explicit: string | null) {
  if (explicit && /^[a-z]{2}$/i.test(explicit)) return explicit.toLowerCase()
  return COUNTRY_HINTS.find(([re]) => re.test(location))?.[1] ?? null
}

export async function GET(request: Request) {
  const userId = await getUserId()
  if (!userId) return error('Unauthorized', 401)

  const { searchParams } = new URL(request.url)
  const query = (searchParams.get('query') || '').trim().slice(0, 200)
  const location = (searchParams.get('location') || '').trim().slice(0, 200)
  const remote = searchParams.get('remote') === 'true'
  const jobType = searchParams.get('jobType') || ''
  const datePosted = searchParams.get('datePosted') || 'all'
  const page = Math.max(1, Math.min(20, parseInt(searchParams.get('page') || '1') || 1))
  const country = countryFor(location, searchParams.get('country'))

  if (!query) return error('Enter a job title or keyword')

  const hasJSearch = Boolean(process.env.RAPIDAPI_KEY)
  const hasAdzuna = Boolean(process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY)

  if (!hasJSearch && !hasAdzuna) {
    return json({ jobs: sampleJobs(query, remote, jobType, datePosted), page, hasMore: false, isSample: true, providers: [] })
  }

  // Adzuna only when it covers the country (it has no Nigeria index, for example).
  const adzunaCountry = !location ? 'gb' : country && ADZUNA_COUNTRIES.includes(country) ? country : null
  const results = await Promise.allSettled([
    hasJSearch ? fetchJSearch(query, location, remote, page, jobType, datePosted, country) : Promise.resolve([]),
    hasAdzuna && !remote && adzunaCountry ? fetchAdzuna(query, location, page, adzunaCountry) : Promise.resolve([]),
  ])

  const failures = results.filter((r) => r.status === 'rejected').length
  for (const r of results) if (r.status === 'rejected') console.warn('Job provider failed:', r.reason instanceof Error ? r.reason.message : r.reason)
  let jobs = results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))

  if (jobType) {
    const t = jobType.toLowerCase().replace(/[^a-z]/g, '')
    jobs = jobs.filter((j) => !j.jobType || j.jobType.toLowerCase().replace(/[^a-z]/g, '').includes(t))
  }
  if (remote) jobs = jobs.filter((j) => j.remote)

  // De-duplicate the same posting coming from both providers.
  const seen = new Set<string>()
  jobs = jobs.filter((j) => {
    const key = `${j.title}|${j.company}`.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  if (jobs.length === 0 && failures === results.length) {
    return error('Job providers are not responding right now. Try again in a minute.', 502)
  }

  return json({
    jobs,
    page,
    hasMore: jobs.length >= 8,
    isSample: false,
    providers: [hasJSearch && 'JSearch', hasAdzuna && 'Adzuna'].filter(Boolean),
  })
}

function guessSource(publisher: unknown): Source {
  const p = String(publisher || '').toLowerCase()
  if (p.includes('linkedin')) return 'LINKEDIN'
  if (p.includes('indeed')) return 'INDEED'
  if (p.includes('glassdoor')) return 'GLASSDOOR'
  if (p.includes('muse')) return 'THE_MUSE'
  return 'OTHER'
}

const JSEARCH_TYPES: Record<string, string> = {
  'full-time': 'FULLTIME',
  'part-time': 'PARTTIME',
  contract: 'CONTRACTOR',
  internship: 'INTERN',
}

async function fetchJSearch(
  query: string,
  location: string,
  remote: boolean,
  page: number,
  jobType: string,
  datePosted: string,
  country: string | null
): Promise<JobListing[]> {
  const q = location ? `${query} in ${location}` : query
  const params = new URLSearchParams({ query: q, page: String(page), num_pages: '1' })
  if (country) params.set('country', country)
  if (remote) params.set('remote_jobs_only', 'true')
  const employment = JSEARCH_TYPES[jobType.toLowerCase()]
  if (employment) params.set('employment_types', employment)
  if (['today', '3days', 'week', 'month'].includes(datePosted)) params.set('date_posted', datePosted)

  // JSearch retired /search in favour of /search-v2 (results now under data.jobs).
  const res = await fetch(`https://jsearch.p.rapidapi.com/search-v2?${params}`, {
    headers: {
      'X-RapidAPI-Key': process.env.RAPIDAPI_KEY!,
      'X-RapidAPI-Host': 'jsearch.p.rapidapi.com',
    },
    next: { revalidate: 600 },
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`JSearch ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const data = await res.json()
  const list: unknown = Array.isArray(data.data) ? data.data : data.data?.jobs
  if (!Array.isArray(list)) return []

  return list.map((job: Record<string, unknown>): JobListing => {
    const place = [job.job_city, job.job_state, job.job_country].filter(Boolean).join(', ')
    const min = Number(job.job_min_salary)
    const max = Number(job.job_max_salary)
    const period = job.job_salary_period ? ` / ${String(job.job_salary_period).toLowerCase()}` : ''
    return {
      id: `jsearch-${job.job_id}`,
      title: String(job.job_title || 'Untitled role'),
      company: String(job.employer_name || 'Unknown company'),
      location: place || (job.job_is_remote ? 'Remote' : 'Location not listed'),
      salary: min && max ? `${formatMoney(min)}–${formatMoney(max)}${period}` : typeof job.job_salary_string === 'string' && job.job_salary_string ? job.job_salary_string : undefined,
      description: typeof job.job_description === 'string' ? job.job_description.slice(0, 6000) : undefined,
      url: String(job.job_apply_link || job.job_google_link || ''),
      source: guessSource(job.job_publisher),
      remote: job.job_is_remote === true,
      jobType: typeof job.job_employment_type === 'string' ? titleCase(job.job_employment_type) : undefined,
      postedAt: typeof job.job_posted_at_datetime_utc === 'string' ? job.job_posted_at_datetime_utc : undefined,
      logo: typeof job.employer_logo === 'string' ? job.employer_logo : undefined,
    }
  })
}

async function fetchAdzuna(query: string, location: string, page: number, country: string): Promise<JobListing[]> {
  const params = new URLSearchParams({
    app_id: process.env.ADZUNA_APP_ID!,
    app_key: process.env.ADZUNA_APP_KEY!,
    results_per_page: '10',
    what: query,
    'content-type': 'application/json',
  })
  if (location) params.set('where', location)

  const res = await fetch(`https://api.adzuna.com/v1/api/jobs/${country}/search/${page}?${params}`, {
    next: { revalidate: 600 },
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`Adzuna ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const data = await res.json()
  if (!Array.isArray(data.results)) return []

  const strip = (s: unknown) => String(s || '').replace(/<[^>]*>/g, '')
  return data.results.map((job: Record<string, unknown>): JobListing => {
    const min = Number(job.salary_min)
    const max = Number(job.salary_max)
    const title = strip(job.title) || 'Untitled role'
    const description = strip(job.description)
    return {
      id: `adzuna-${job.id}`,
      title,
      company: (job.company as { display_name?: string })?.display_name || 'Unknown company',
      location: (job.location as { display_name?: string })?.display_name || 'Location not listed',
      salary: min && max ? `${formatMoney(min)}–${formatMoney(max)}` : undefined,
      description,
      url: String(job.redirect_url || ''),
      source: 'ADZUNA',
      remote: /remote/i.test(title) || /fully remote|remote-first|work from home/i.test(description),
      jobType: job.contract_time === 'full_time' ? 'Full-time' : job.contract_time === 'part_time' ? 'Part-time' : job.contract_type === 'contract' ? 'Contract' : undefined,
      postedAt: typeof job.created === 'string' ? job.created : undefined,
    }
  })
}

function formatMoney(n: number) {
  return n >= 1000 ? `${Math.round(n / 1000)}k` : String(Math.round(n))
}

function titleCase(s: string) {
  const map: Record<string, string> = { FULLTIME: 'Full-time', PARTTIME: 'Part-time', CONTRACTOR: 'Contract', INTERN: 'Internship' }
  return map[s] ?? s.charAt(0) + s.slice(1).toLowerCase()
}

const SAMPLE_JOBS: (Omit<JobListing, 'postedAt'> & { hoursAgo: number })[] = [
  { id: 'sample-j1', title: 'Product Designer', company: 'Lumen Grid', location: 'Berlin · Hybrid', salary: '€65–80k', source: 'LINKEDIN', hoursAgo: 48, jobType: 'Full-time', remote: false, url: '' },
  { id: 'sample-j2', title: 'Senior Product Designer', company: 'Fieldnote', location: 'Remote', salary: '€80–95k', source: 'COMPANY_SITE', hoursAgo: 120, jobType: 'Full-time', remote: true, url: '' },
  { id: 'sample-j3', title: 'UX Designer', company: 'Harbor Transit', location: 'Amsterdam', salary: '€55–68k', source: 'INDEED', hoursAgo: 24, jobType: 'Full-time', remote: false, url: '' },
  { id: 'sample-j4', title: 'Freelance UI Designer', company: 'Oak & Ember', location: 'Remote', salary: '€450 / day', source: 'INDEED', hoursAgo: 72, jobType: 'Contract', remote: true, url: '' },
  { id: 'sample-j5', title: 'Design Systems Designer', company: 'Parcel', location: 'London · Hybrid', salary: '£60–72k', source: 'LINKEDIN', hoursAgo: 72, jobType: 'Full-time', remote: false, url: '' },
  { id: 'sample-j6', title: 'Product Designer, Growth', company: 'Tandem Works', location: 'Remote', salary: '€60–72k', source: 'LINKEDIN', hoursAgo: 168, jobType: 'Full-time', remote: true, url: '' },
]

function sampleJobs(query: string, remote: boolean, jobType: string, datePosted: string): JobListing[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  const maxHours = { today: 24, '3days': 72, week: 168, month: 720 }[datePosted] ?? Infinity
  return SAMPLE_JOBS.filter(
    (j) =>
      (!remote || j.remote) &&
      (!jobType || j.jobType === jobType) &&
      j.hoursAgo <= maxHours &&
      (!words.length || words.some((w) => `${j.title} ${j.company}`.toLowerCase().includes(w)))
  ).map(({ hoursAgo, ...j }) => ({
    ...j,
    postedAt: new Date(Date.now() - hoursAgo * 3_600_000).toISOString(),
    description: `${j.company} is hiring a ${j.title.toLowerCase()} to work with product and engineering on customer-facing features. You'll own problems end to end, from research through shipped UI.

What you'll do
- Turn research and data into clear flows and high-fidelity designs
- Contribute to and extend the design system
- Run usability sessions and share findings with the team`,
  }))
}
