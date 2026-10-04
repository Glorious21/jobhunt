import type { Source, Status } from './constants'

export interface EmailItem {
  id: string
  applicationId: string
  gmailMessageId: string | null
  threadId: string | null
  subject: string | null
  snippet: string | null
  from: string | null
  to: string | null
  date: string | null
  isResponse: boolean
  category: string | null
  labels: string[]
  createdAt: string
}

/** Application as serialized over the wire (dates are ISO strings). */
export interface Application {
  id: string
  userId: string
  status: Status
  source: Source
  jobTitle: string
  company: string
  location: string | null
  salary: string | null
  jobUrl: string | null
  description: string | null
  jobType: string | null
  remote: boolean
  notes: string | null
  resumeUsed: string | null
  coverLetterUsed: string | null
  appliedAt: string | null
  respondedAt: string | null
  interviewAt: string | null
  interviewType: string | null
  deadline: string | null
  createdAt: string
  updatedAt: string
  emails?: EmailItem[]
}

export type ApplicationInput = Partial<
  Pick<
    Application,
    | 'status'
    | 'source'
    | 'jobTitle'
    | 'company'
    | 'location'
    | 'salary'
    | 'jobUrl'
    | 'description'
    | 'jobType'
    | 'remote'
    | 'notes'
    | 'resumeUsed'
    | 'coverLetterUsed'
    | 'appliedAt'
    | 'respondedAt'
    | 'interviewAt'
    | 'interviewType'
    | 'deadline'
  >
>

export interface JobListing {
  id: string
  title: string
  company: string
  location: string
  salary?: string
  description?: string
  url: string
  source: Source
  remote: boolean
  jobType?: string
  postedAt?: string
  logo?: string
}

export interface UserDocument {
  id: string
  userId: string
  type: string
  fileName: string
  fileUrl: string
  parsedText: string | null
  skills: string[]
  experience: string[]
  hasFile?: boolean
  createdAt: string
  updatedAt: string
}

export interface Profile {
  id: string
  name: string | null
  email: string | null
  image: string | null
  isDemo: boolean
  onboarded: boolean
  targetRole: string | null
  targetLocation: string | null
  dailyMin: number
  dailyMax: number
  portfolioUrl: string | null
  hasPassword: boolean
  providers: string[]
  gmailSyncedAt: string | null
  phone: string | null
  linkedinUrl: string | null
  githubUrl: string | null
}

export interface TailorResult {
  mode: 'ai' | 'keywords'
  matchScore: number
  matchingSkills: string[]
  missingSkills: string[]
  tailoredSummary?: string
  tailoredBulletPoints?: string[]
  coverLetter?: string
  inMailPitch?: string
  interviewTips?: string[]
}
