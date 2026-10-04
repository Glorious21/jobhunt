// One-off migration: rename pipeline stages to the 2026 design's model.
//   AWAITING  -> APPLIED     (sent, no reply yet)
//   RESPONDED -> SCREENING   (recruiter replied / early conversations)
//   ACCEPTED  -> OFFER
//   DECLINED  -> REJECTED
// Safe to run more than once. Usage: npm run migrate:statuses
import { PrismaClient } from '@prisma/client'

const RENAMES = [
  ['AWAITING', 'APPLIED'],
  ['RESPONDED', 'SCREENING'],
  ['ACCEPTED', 'OFFER'],
  ['DECLINED', 'REJECTED'],
]

const prisma = new PrismaClient()
try {
  const result = await prisma.$runCommandRaw({
    update: 'Application',
    updates: RENAMES.map(([from, to]) => ({ q: { status: from }, u: { $set: { status: to } }, multi: true })),
  })
  console.log(`Updated ${result.nModified ?? 0} application(s).`)
} finally {
  await prisma.$disconnect()
}
