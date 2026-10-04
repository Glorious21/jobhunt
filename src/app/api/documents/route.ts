import { prisma } from '@/lib/prisma'
import { error, getUserId, json, OBJECT_ID, optString, readJson } from '@/lib/api'
import { extractSkills } from '@/lib/skills'

const TYPES = ['cv', 'portfolio', 'cover_letter_template']

// Everything except the stored file bytes.
const SELECT = {
  id: true, userId: true, type: true, fileName: true, fileUrl: true, parsedText: true,
  skills: true, experience: true, mimeType: true, createdAt: true, updatedAt: true,
} as const
type DocRow = { mimeType: string | null } & Record<string, unknown>
const withFlag = (d: DocRow) => ({ ...d, hasFile: Boolean(d.mimeType) })

// GET /api/documents
export async function GET() {
  const userId = await getUserId()
  if (!userId) return error('Unauthorized', 401)
  try {
    const documents = await prisma.userDocument.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: SELECT,
    })
    return json({ documents: documents.map(withFlag) })
  } catch (err) {
    console.error('Failed to fetch documents:', err)
    return error('Failed to load documents', 500)
  }
}

// POST /api/documents — save a document (text content)
export async function POST(request: Request) {
  const userId = await getUserId()
  if (!userId) return error('Unauthorized', 401)
  const body = await readJson(request)
  if (!body) return error('Invalid request body')

  const fileName = optString(body.fileName, 200)
  const parsedText = optString(body.parsedText, 50000)
  const type = typeof body.type === 'string' && TYPES.includes(body.type) ? body.type : 'cv'
  if (!fileName) return error('Give the document a name')
  if (!parsedText) return error('Document text is empty')

  try {
    const document = await prisma.userDocument.create({
      data: {
        userId,
        type,
        fileName,
        fileUrl: optString(body.fileUrl, 500) ?? '',
        parsedText,
        skills: extractSkills(parsedText),
        experience: [],
      },
      select: SELECT,
    })
    return json({ document: withFlag(document) }, 201)
  } catch (err) {
    console.error('Failed to save document:', err)
    return error('Failed to save document', 500)
  }
}

// PATCH /api/documents?id= — rename or replace text
export async function PATCH(request: Request) {
  const userId = await getUserId()
  if (!userId) return error('Unauthorized', 401)
  const id = new URL(request.url).searchParams.get('id') ?? ''
  if (!OBJECT_ID.test(id)) return error('Document not found', 404)
  const body = await readJson(request)
  if (!body) return error('Invalid request body')

  const owned = await prisma.userDocument.findFirst({ where: { id, userId } })
  if (!owned) return error('Document not found', 404)

  const fileName = optString(body.fileName, 200)
  const parsedText = optString(body.parsedText, 50000)
  const document = await prisma.userDocument.update({
    where: { id },
    data: {
      ...(fileName ? { fileName } : {}),
      ...(parsedText ? { parsedText, skills: extractSkills(parsedText) } : {}),
    },
    select: SELECT,
  })
  return json({ document: withFlag(document) })
}

// DELETE /api/documents?id=
export async function DELETE(request: Request) {
  const userId = await getUserId()
  if (!userId) return error('Unauthorized', 401)
  const id = new URL(request.url).searchParams.get('id') ?? ''
  if (!OBJECT_ID.test(id)) return error('Document not found', 404)

  try {
    const result = await prisma.userDocument.deleteMany({ where: { id, userId } })
    if (result.count === 0) return error('Document not found', 404)
    return json({ success: true })
  } catch (err) {
    console.error('Failed to delete document:', err)
    return error('Failed to delete document', 500)
  }
}
