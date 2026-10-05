// Turns a pasted job post (WhatsApp/Telegram message, email, LinkedIn post, web page text)
// into structured application fields. Pure functions — safe on server and client.

import type { Source } from './constants'

export interface ParsedJob {
  company: string | null
  jobTitle: string | null
  location: string | null
  jobType: string | null
  salary: string | null
  deadline: string | null // ISO date
  applyUrl: string | null
  applyEmail: string | null
  remote: boolean
  source: Source | null
  requirements: string[]
  description: string
}

const CITIES = [
  'Ikeja', 'Lekki', 'Victoria Island', 'Ikoyi', 'Yaba', 'Surulere', 'Ajah', 'Maryland', 'Gbagada', 'Apapa',
  'Lagos', 'Abuja', 'Port Harcourt', 'Ibadan', 'Kano', 'Enugu', 'Benin City', 'Kaduna', 'Abeokuta', 'Owerri', 'Uyo', 'Calabar', 'Jos', 'Ilorin', 'Warri', 'Akure',
  'Accra', 'Nairobi', 'Kigali', 'Cape Town', 'Johannesburg', 'Cairo',
  'London', 'Manchester', 'Dublin', 'Berlin', 'Amsterdam', 'Paris', 'Lisbon', 'Madrid', 'Barcelona', 'Rotterdam',
  'New York', 'San Francisco', 'Toronto', 'Dubai',
]

const URL_RE = /https?:\/\/[^\s<>()"'*]+[^\s<>()"'*.,;:!?]/gi
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi

/** Strip WhatsApp/Telegram/markdown emphasis and invisible characters. */
export function cleanPostText(text: string) {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[​-‍﻿]/g, '')
    .replace(/(^|[\s(])[*_~]+(?=\S)/g, '$1')
    .replace(/(?<=\S)[*_~]+(?=[\s).,:;!?]|$)/gm, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function guessSource(raw: string): Source | null {
  if (/linkedin\.com/i.test(raw)) return 'LINKEDIN'
  if (/indeed\./i.test(raw)) return 'INDEED'
  if (/glassdoor\./i.test(raw)) return 'GLASSDOOR'
  if (/t\.me\/|telegram/i.test(raw)) return 'TELEGRAM'
  if (/chat\.whatsapp|wa\.me/i.test(raw)) return 'WHATSAPP'
  // *bold* and _italic_ markers are how WhatsApp formats messages.
  if (/(^|\n)\*[^*\n]{3,}\*\s*(\n|$)/.test(raw) || /(^|\n)_[^_\n]{8,}_\s*(\n|$)/.test(raw)) return 'WHATSAPP'
  return null
}

/** Value after a "Label:" line, e.g. labelled(lines, ['location', 'job location']). */
function labelled(lines: string[], labels: string[]): string | null {
  for (const line of lines) {
    const m = line.match(/^\s*[-•]?\s*([A-Za-z /]+?)\s*[:\-–]\s*(.+)$/)
    if (m && labels.includes(m[1].trim().toLowerCase())) return m[2].trim()
  }
  return null
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

/** Parses "October 9, 2026", "9th October 2026", "9/10/2026" (day-first), "2026-10-09". */
export function parseDeadline(text: string, now = new Date()): string | null {
  const t = text.toLowerCase().replace(/(\d)(st|nd|rd|th)\b/g, '$1').replace(/,/g, ' ')
  let y: number | undefined, m: number | undefined, d: number | undefined
  let match = t.match(/(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (match) [y, m, d] = [+match[1], +match[2] - 1, +match[3]]
  if (!match && (match = t.match(/([a-z]{3,9})\.?\s+(\d{1,2})(?:\s+(\d{4}))?/))) {
    const mi = MONTHS.indexOf(match[1].slice(0, 3))
    if (mi >= 0) [m, d, y] = [mi, +match[2], match[3] ? +match[3] : undefined]
  }
  if (m === undefined && (match = t.match(/(\d{1,2})\s+([a-z]{3,9})\.?(?:\s+(\d{4}))?/))) {
    const mi = MONTHS.indexOf(match[2].slice(0, 3))
    if (mi >= 0) [d, m, y] = [+match[1], mi, match[3] ? +match[3] : undefined]
  }
  if (m === undefined && (match = t.match(/(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})/))) {
    // Day-first, as written in Nigeria, the UK and most of the world.
    ;[d, m, y] = [+match[1], +match[2] - 1, +match[3] < 100 ? 2000 + +match[3] : +match[3]]
  }
  if (m === undefined || d === undefined || d < 1 || d > 31 || m < 0 || m > 11) return null
  if (y === undefined) {
    y = now.getFullYear()
    if (new Date(y, m, d) < new Date(now.getFullYear(), now.getMonth(), now.getDate())) y++
  }
  const date = new Date(Date.UTC(y, m, d, 12))
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function titleCase(s: string) {
  return s.replace(/\s+/g, ' ').trim().replace(/^./, (c) => c.toUpperCase())
}

/** "Acme is hiring a Product Designer", "Acme is recruiting graduates for its X Program", "X at Acme", "Acme – X". */
function companyAndRole(headline: string): { company: string | null; role: string | null } {
  const h = headline.replace(/^(job\s+(vacancy|opening|alert)|vacancy|we'?re hiring|hiring)\s*[:!\-–]?\s*/i, '').replace(/[!.]+$/, '').trim()
  let m = h.match(/^(.+?)\s+(?:is|are)\s+(?:currently\s+)?(?:hiring|recruiting|looking for)\s+(.+)$/i)
  if (m) {
    let role = m[2]
    const forIts = role.match(/\bfor\s+(?:its|their|the|our)\s+(.+)$/i)
    if (forIts) role = forIts[1]
    role = role.replace(/^(an?|the)\s+/i, '').replace(/\s+(?:in|at|for)\s+[A-Z][\w\s]+$/, (x) => (/\b(program|programme|role|position)\b/i.test(x) ? x : ''))
    return { company: m[1].trim(), role: titleCase(role) }
  }
  m = h.match(/^(.+?)\s+(?:at|@)\s+(.+)$/i)
  if (m && m[1].split(' ').length <= 8) {
    // "Designer at Kuda — remote, contract. Apply…" → company is "Kuda"
    const company = m[2].split(/\s[—–-]\s|[.,;:!(|]|\s(?:is|in|for|via)\s/)[0].trim()
    return { company: company || null, role: titleCase(m[1]) }
  }
  m = h.match(/^(.+?)\s+[–—|]\s+(.+)$/)
  if (m) return { company: m[1].trim(), role: titleCase(m[2]) }
  return { company: null, role: null }
}

export function parseJobPost(raw: string, now = new Date()): ParsedJob {
  const text = cleanPostText(raw)
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  const lower = text.toLowerCase()

  const urls = [...text.matchAll(URL_RE)].map((m) => m[0])
  const applyLine = lines.find((l) => /^(apply|application link|how to apply|link)\b/i.test(l))
  const applyUrl = (applyLine && applyLine.match(URL_RE)?.[0]) || urls.find((u) => /apply|career|jobs?|forms?\.(gle|google)|docs\.google\.com\/forms|greenhouse|lever\.co|workday|bamboohr|smartrecruiters/i.test(u)) || urls[0] || null
  const emails = [...text.matchAll(EMAIL_RE)].map((m) => m[0])
  const applyEmail = emails.find((e) => /career|job|hr|recruit|talent|apply|hiring/i.test(e)) ?? (applyUrl ? null : emails[0] ?? null)

  const fromHeadline = companyAndRole(lines[0] ?? '')
  const company = labelled(lines, ['company', 'organisation', 'organization', 'employer', 'company name']) ?? fromHeadline.company
  // "…needs a Customer Success Associate", "…is looking for a Product Designer"
  const roleInProse = text.match(/\b(?:needs?|is looking for|are looking for|seeks?|seeking|is hiring|are hiring|hiring)\s+(?:an?\s+|the\s+)?((?:[A-Z][\w&/+-]*\s*){1,6})/)?.[1]?.trim()
  const jobTitle =
    labelled(lines, ['job title', 'position', 'role', 'title', 'job role', 'vacancy']) ??
    fromHeadline.role ??
    (roleInProse && roleInProse.split(/\s+/).length >= 2 ? roleInProse : null) ??
    (lines[0] && lines[0].length < 80 ? titleCase(lines[0]) : null)

  let location = labelled(lines, ['location', 'job location', 'locations', 'based in', 'work location'])
  const remote = /\b(remote|work from home|wfh|anywhere)\b/i.test(text)
  if (!location) location = CITIES.find((c) => new RegExp(`\\b${c}\\b`, 'i').test(text)) ?? (remote ? 'Remote' : /\bNYSC\b/.test(text) ? 'Nigeria' : null)

  const jobType =
    labelled(lines, ['job type', 'type', 'employment type', 'contract type']) ??
    (/\bfull[\s-]?time\b/i.test(lower) ? 'Full-time' : /\bpart[\s-]?time\b/i.test(lower) ? 'Part-time' : /\bcontract\b/i.test(lower) ? 'Contract' : /\b(internship|intern)\b/i.test(lower) ? 'Internship' : null)

  const salaryLine = labelled(lines, ['salary', 'pay', 'remuneration', 'compensation', 'stipend'])
  const salary = salaryLine && /[\d₦$£€]|naira|k\b/i.test(salaryLine) ? salaryLine : null

  const deadlineText =
    labelled(lines, ['deadline', 'application deadline', 'closing date', 'apply before', 'closes']) ??
    lines.find((l) => /deadline|closing date|apply before/i.test(l)) ??
    lines.find((l) => /\b(before|by|not later than)\b.*\d/i.test(l)) ??
    null
  const deadline = deadlineText ? parseDeadline(deadlineText, now) : null

  // Bullet lines under a "Requirements"/"Qualifications" heading.
  const requirements: string[] = []
  let inReq = false
  for (const line of lines) {
    if (/^(requirements?|qualifications?|who (we'?re|we are) looking for|eligibility|what you need)\b/i.test(line)) {
      inReq = true
      continue
    }
    if (inReq) {
      if (/^[-•*·▪●]\s*/.test(line) || /^\d+[.)]\s+/.test(line)) requirements.push(line.replace(/^([-•*·▪●]|\d+[.)])\s*/, ''))
      else if (/^[A-Z][^.]{0,40}:\s*$/.test(line) || /^[A-Z][\w\s]{0,30}:/.test(line)) inReq = false
    }
  }

  return {
    company: company ? company.slice(0, 200) : null,
    jobTitle: jobTitle ? jobTitle.slice(0, 200) : null,
    location,
    jobType,
    salary,
    deadline,
    applyUrl,
    applyEmail,
    remote,
    source: guessSource(raw),
    requirements,
    description: text,
  }
}
