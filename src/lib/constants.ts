// Shared between server and client — keep free of server-only imports.

export const STATUSES = ['SAVED', 'APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED'] as const
export type Status = (typeof STATUSES)[number]

export const STATUS_LABEL: Record<Status, string> = {
  SAVED: 'Saved',
  APPLIED: 'Applied',
  SCREENING: 'Screening',
  INTERVIEW: 'Interview',
  OFFER: 'Offer',
  HIRED: 'Hired',
  REJECTED: 'Rejected',
}

/** One hue per stage: chip bg oklch(0.95 0.045 H), text oklch(0.45 0.12 H). */
export const STATUS_HUE: Record<Status, number> = {
  SAVED: 250,
  APPLIED: 215,
  SCREENING: 290,
  INTERVIEW: 140,
  OFFER: 80,
  HIRED: 160,
  REJECTED: 25,
}

export function hueChip(hue: number) {
  return { background: `oklch(0.95 0.045 ${hue})`, color: `oklch(0.45 0.12 ${hue})` }
}
export const statusChip = (s: Status) => hueChip(STATUS_HUE[s])

export const SOURCES = [
  'LINKEDIN',
  'COMPANY_SITE',
  'REFERRAL',
  'INDEED',
  'RECRUITER',
  'GLASSDOOR',
  'ADZUNA',
  'THE_MUSE',
  'TWITTER',
  'WHATSAPP',
  'TELEGRAM',
  'MANUAL',
  'OTHER',
] as const
export type Source = (typeof SOURCES)[number]

export const SOURCE_LABEL: Record<Source, string> = {
  LINKEDIN: 'LinkedIn',
  COMPANY_SITE: 'Company site',
  REFERRAL: 'Referral',
  INDEED: 'Indeed',
  RECRUITER: 'Recruiter',
  GLASSDOOR: 'Glassdoor',
  ADZUNA: 'Adzuna',
  THE_MUSE: 'The Muse',
  TWITTER: 'X / Twitter',
  WHATSAPP: 'WhatsApp',
  TELEGRAM: 'Telegram',
  MANUAL: 'Direct',
  OTHER: 'Other',
}

/** Channels offered in the application editor. */
export const EDITOR_CHANNELS: Source[] = ['LINKEDIN', 'COMPANY_SITE', 'REFERRAL', 'INDEED', 'RECRUITER']

export const JOB_TYPES = ['Full-time', 'Part-time', 'Contract', 'Internship', 'Temporary'] as const

/** Stages that mean the application has been sent. */
export const SENT_STATUSES: Status[] = ['APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED']
/** Stages that imply an employer reply (Rejected may be a ghost, so it doesn't). */
export const REPLY_STATUSES: Status[] = ['SCREENING', 'INTERVIEW', 'OFFER', 'HIRED']
/** "Applied through offer". */
export const ACTIVE_STATUSES: Status[] = ['APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER']

/** Pipeline order, used so suggestions never move an application backwards. */
export const STATUS_RANK: Record<Status, number> = {
  SAVED: 0,
  APPLIED: 1,
  SCREENING: 2,
  INTERVIEW: 3,
  OFFER: 4,
  HIRED: 5,
  REJECTED: 5,
}

export const EMAIL_LABELS = ['interview', 'offer', 'rejection', 'reply', 'confirmation'] as const
export const EMAIL_LABEL_NAME: Record<string, string> = {
  interview: 'Interview',
  offer: 'Offer',
  rejection: 'Rejection',
  reply: 'Reply',
  confirmation: 'Confirmation',
}
export const EMAIL_HUE: Record<string, number> = { interview: 140, offer: 80, rejection: 25, reply: 250, confirmation: 215 }
/** Stage an email category suggests moving the application to. */
export const EMAIL_SUGGEST: Record<string, Status | undefined> = {
  interview: 'INTERVIEW',
  offer: 'OFFER',
  rejection: 'REJECTED',
  reply: 'SCREENING',
}

export function isStatus(v: unknown): v is Status {
  return typeof v === 'string' && (STATUSES as readonly string[]).includes(v)
}

export function isSource(v: unknown): v is Source {
  return typeof v === 'string' && (SOURCES as readonly string[]).includes(v)
}
