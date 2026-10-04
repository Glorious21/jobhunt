import { randomBytes } from 'crypto'
import type { ApplicationStatus, JobSource } from '@prisma/client'
import { prisma } from '@/lib/prisma'

const DAY = 86_400_000
const MIN = 60_000

interface Seed {
  key: string
  company: string
  role: string
  status: ApplicationStatus
  channel: JobSource
  /** days since applied (0 = not applied) */
  days: number
  /** minutes since last update */
  mins: number
  location: string
  salary: string
  notes?: string
  interview?: { inDays: number; hour: number; minute: number; type: string }
}

// Sample data from the design handoff.
const SEEDS: Seed[] = [
  { key: 'a1', company: 'Northwind Labs', role: 'Product Designer', status: 'INTERVIEW', channel: 'LINKEDIN', days: 12, mins: 120, location: 'Remote', salary: '€70–85k', notes: 'Portfolio review with design lead. Prep the logistics case study.', interview: { inDays: 3, hour: 14, minute: 0, type: 'Portfolio review' } },
  { key: 'a2', company: 'Fieldnote', role: 'Senior UX Designer', status: 'APPLIED', channel: 'COMPANY_SITE', days: 9, mins: 300, location: 'Berlin · Hybrid', salary: '€80–95k' },
  { key: 'a3', company: 'Hollis & Co', role: 'Design Systems Lead', status: 'SCREENING', channel: 'REFERRAL', days: 6, mins: 420, location: 'London', salary: '£75–90k', interview: { inDays: 6, hour: 16, minute: 0, type: 'Screening call' } },
  { key: 'a4', company: 'Brightpath Health', role: 'UX Researcher', status: 'APPLIED', channel: 'INDEED', days: 11, mins: 1500, location: 'Remote', salary: '€60–70k' },
  { key: 'a5', company: 'Kettle', role: 'Product Designer', status: 'OFFER', channel: 'RECRUITER', days: 20, mins: 60, location: 'Amsterdam', salary: '€78k' },
  { key: 'a6', company: 'Atlas Freight', role: 'UI Designer', status: 'REJECTED', channel: 'LINKEDIN', days: 15, mins: 2900, location: 'Rotterdam', salary: '€55–65k' },
  { key: 'a7', company: 'Morrow Studio', role: 'Visual Designer', status: 'SAVED', channel: 'COMPANY_SITE', days: 0, mins: 4300, location: 'Remote', salary: '' },
  { key: 'a8', company: 'Quarry', role: 'Product Designer II', status: 'INTERVIEW', channel: 'REFERRAL', days: 8, mins: 200, location: 'Remote', salary: '€72–84k', interview: { inDays: 5, hour: 10, minute: 30, type: 'Hiring manager' } },
  { key: 'a9', company: 'Pinewood Bank', role: 'UX Designer', status: 'APPLIED', channel: 'COMPANY_SITE', days: 3, mins: 800, location: 'Dublin', salary: '€65–75k' },
  { key: 'a10', company: 'Tandem Works', role: 'Interaction Designer', status: 'APPLIED', channel: 'LINKEDIN', days: 1, mins: 30, location: 'Remote', salary: '€60–72k' },
  { key: 'a11', company: 'Sable', role: 'Design Engineer', status: 'SCREENING', channel: 'COMPANY_SITE', days: 4, mins: 600, location: 'Remote', salary: '€80–90k' },
]

const EMAILS = [
  { app: 'a1', from: 'Maya at Northwind Labs <maya@northwind.example>', category: 'interview', subject: 'Portfolio review confirmed for Tuesday', snippet: 'Thanks Alex, we have you down for Tuesday at 14:00. You’ll meet Priya and Tom from the design team.', daysAgo: 0, hour: 9, minute: 12 },
  { app: 'a11', from: 'Sable Talent <talent@sable.example>', category: 'interview', subject: 'We’d like to schedule an interview', snippet: 'We enjoyed your application and would love to set up a 45-minute call with our engineering lead.', daysAgo: 1, hour: 16, minute: 40 },
  { app: 'a2', from: 'Jonas, Fieldnote <jonas@fieldnote.example>', category: 'reply', subject: 'Quick chat about the Senior UX role?', snippet: 'Your portfolio caught our eye. Do you have 20 minutes this week for an intro call?', daysAgo: 1, hour: 11, minute: 5 },
  { app: 'a5', from: 'Kettle People Team <people@kettle.example>', category: 'offer', subject: 'Your offer from Kettle', snippet: 'We’re delighted to offer you the Product Designer role. The offer letter is attached.', daysAgo: 6, hour: 15, minute: 20 },
  { app: 'a6', from: 'Atlas Freight Careers <careers@atlasfreight.example>', category: 'rejection', subject: 'Update on your application', snippet: 'Thank you for your interest. We’ve decided to move forward with other candidates for this role.', daysAgo: 5, hour: 10, minute: 0 },
  { app: 'a9', from: 'Pinewood Bank <jobs@pinewood.example>', category: 'confirmation', subject: 'Application received', snippet: 'We’ve received your application for UX Designer and will be in touch within two weeks.', daysAgo: 3, hour: 13, minute: 45 },
]

const CV_TEXT = `Alex Morgan — Product Designer
Remote · Europe · alexmorgan.design

SUMMARY
Product designer with six years shipping B2B tools, focused on design systems and accessible interfaces. Led the component library used by 40 engineers at a logistics scale-up.

EXPERIENCE
Senior Product Designer — Freightline (2022 – present)
- Led the design system and component library used by 40 engineers.
- Ran user research and usability testing for the carrier onboarding flow.
- Prototyping in Figma; shipped accessible UI with HTML/CSS handoff.

Product Designer — Ledgerly (2019 – 2022)
- Designed reporting dashboards and data viz for finance teams.
- Facilitated workshops with stakeholders to define product strategy.

SKILLS
Figma, Prototyping, Design systems, User research, Usability testing, Accessibility, HTML/CSS, Wireframing, Workshops`

const DOCS = [
  { fileName: 'CV, Product Designer 2026.pdf', type: 'cv', daysAgo: 3, text: CV_TEXT, skills: ['Figma', 'Prototyping', 'Design systems', 'User research', 'Accessibility', 'HTML/CSS'] },
  { fileName: 'Portfolio, case studies', type: 'portfolio', daysAgo: 14, text: 'Case studies: carrier onboarding redesign (Freightline), reporting dashboards and data viz (Ledgerly), design system rollout. Includes workshops and research summaries.', skills: ['Case studies', 'Workshops', 'Data viz'] },
  { fileName: 'Cover letter template', type: 'cover_letter_template', daysAgo: 30, text: 'Dear {hiring manager},\n\nI’m applying for the {role} role at {company}. I care about product strategy and working closely with stakeholders…', skills: ['Product strategy', 'Stakeholders'] },
]

const HISTORY_COMPANIES = ['Verdant', 'Lattice Works', 'Copperline', 'Meridian Health', 'Brightwave', 'Orbit Logistics', 'Juniper Labs', 'Foundry & Co', 'Halcyon', 'Northgate', 'Arbor', 'Saltmarsh', 'Kite Analytics', 'Mosaic', 'Ridgeline', 'Fable Studio', 'Granite Bank', 'Wren', 'Tidal', 'Plover']
const HISTORY_ROLES = ['Product Designer', 'UX Designer', 'UI Designer', 'Senior Product Designer', 'Interaction Designer', 'UX Researcher']
const HISTORY_CHANNELS: JobSource[] = ['LINKEDIN', 'LINKEDIN', 'COMPANY_SITE', 'INDEED', 'LINKEDIN', 'REFERRAL', 'COMPANY_SITE', 'RECRUITER']

/** Applications per day for the history, chosen to give a 6-day current streak and a 14-day best at a minimum of 5. */
function historyTarget(day: number) {
  if (day === 0) return 3
  if (day <= 6) return [6, 5, 7, 5, 6, 8][day - 1]
  if (day === 7) return 2
  if (day <= 21) return 5 + ((day * 7) % 3)
  if (day === 22) return 1
  const r = (day * 37 + 11) % 13
  return r < 2 ? 0 : r < 5 ? 1 : r < 8 ? 3 : r < 11 ? 4 : 6
}

export async function createDemoUser() {
  const now = Date.now()
  const tag = randomBytes(5).toString('hex')

  const user = await prisma.user.create({
    data: {
      email: `demo-${tag}@demo.jobhunt.local`,
      name: 'Alex Morgan',
      isDemo: true,
      onboarded: true,
      targetRole: 'Product Designer',
      targetLocation: 'Remote · Europe',
      portfolioUrl: 'alexmorgan.design',
      dailyMin: 5,
      dailyMax: 8,
    },
  })

  /** A time `daysAgo` local days back, at the given local hour. */
  const at = (daysAgo: number, hour: number, minute = 0) => {
    const d = new Date(now - daysAgo * DAY)
    d.setHours(hour, minute, 0, 0)
    return d
  }

  const seeded = SEEDS.map((s) => {
    const replied = ['SCREENING', 'INTERVIEW', 'OFFER', 'HIRED'].includes(s.status) || s.key === 'a6'
    return {
      userId: user.id,
      company: s.company,
      jobTitle: s.role,
      status: s.status,
      source: s.channel,
      location: s.location,
      salary: s.salary || null,
      remote: s.location === 'Remote',
      jobType: 'Full-time',
      notes: s.notes ?? null,
      appliedAt: s.days ? at(s.days, 10, 15) : null,
      respondedAt: replied && s.days ? at(Math.max(0, s.days - 3), 15) : null,
      interviewAt: s.interview ? at(-s.interview.inDays, s.interview.hour, s.interview.minute) : null,
      interviewType: s.interview?.type ?? null,
      createdAt: new Date(now - Math.max(s.days * DAY, s.mins * MIN)),
      updatedAt: new Date(now - s.mins * MIN),
    }
  })

  const seededPerDay = new Map<number, number>()
  for (const s of SEEDS) if (s.days) seededPerDay.set(s.days, (seededPerDay.get(s.days) ?? 0) + 1)

  const history = []
  for (let day = 0; day < 112; day++) {
    const count = Math.max(0, historyTarget(day) - (seededPerDay.get(day) ?? 0))
    for (let i = 0; i < count; i++) {
      const n = day * 7 + i
      const appliedAt = at(day, 9 + (i % 8), (n * 13) % 60)
      // Recent ones are still waiting; older ones either got a reply then closed, or went quiet.
      const replied = day > 7 && n % 4 === 0
      const status: ApplicationStatus = day <= 7 ? 'APPLIED' : 'REJECTED'
      const updatedAt = day === 0 ? new Date(now - (6 * 60 + i * 10) * MIN) : replied ? at(Math.max(1, day - 5), 16) : appliedAt
      history.push({
        userId: user.id,
        company: HISTORY_COMPANIES[n % HISTORY_COMPANIES.length],
        jobTitle: HISTORY_ROLES[(n * 5) % HISTORY_ROLES.length],
        status,
        source: HISTORY_CHANNELS[n % HISTORY_CHANNELS.length],
        location: n % 3 === 0 ? 'Remote' : ['Berlin', 'Amsterdam', 'London', 'Lisbon'][n % 4],
        salary: null,
        remote: n % 3 === 0,
        jobType: 'Full-time',
        notes: null,
        appliedAt,
        respondedAt: replied ? at(Math.max(1, day - 5), 16) : null,
        interviewAt: null,
        interviewType: null,
        createdAt: appliedAt,
        updatedAt,
      })
    }
  }

  await prisma.application.createMany({ data: [...seeded, ...history] })

  const apps = await prisma.application.findMany({
    where: { userId: user.id, company: { in: SEEDS.map((s) => s.company) } },
    select: { id: true, company: true },
  })
  const idFor = (key: string) => apps.find((a) => a.company === SEEDS.find((s) => s.key === key)!.company)?.id

  await prisma.email.createMany({
    data: EMAILS.flatMap((e) => {
      const applicationId = idFor(e.app)
      if (!applicationId) return []
      return [{
        applicationId,
        from: e.from,
        subject: e.subject,
        snippet: e.snippet,
        date: at(e.daysAgo, e.hour, e.minute),
        isResponse: true,
        category: e.category,
        labels: [],
      }]
    }),
  })

  await prisma.userDocument.createMany({
    data: DOCS.map((d) => ({
      userId: user.id,
      type: d.type,
      fileName: d.fileName,
      parsedText: d.text,
      skills: d.skills,
      experience: [],
      createdAt: new Date(now - d.daysAgo * DAY),
      updatedAt: new Date(now - d.daysAgo * DAY),
    })),
  })

  return user
}
