import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { error, getUserId, json, OBJECT_ID } from '@/lib/api'
import { MAX_UPLOAD_BYTES } from '@/lib/extract-text'

const ALLOWED = /\.(pdf|docx|doc|rtf|txt|md|markdown)$/i

// GET /api/documents/file?id= — download the original upload (used by the extension to attach your CV)
export async function GET(request: Request) {
  const userId = await getUserId()
  if (!userId) return error('Unauthorized', 401)
  const id = new URL(request.url).searchParams.get('id') ?? ''
  if (!OBJECT_ID.test(id)) return error('Document not found', 404)

  const doc = await prisma.userDocument.findFirst({ where: { id, userId }, select: { fileName: true, fileData: true, mimeType: true } })
  if (!doc?.fileData) return error('No file stored for this document', 404)

  return new NextResponse(Buffer.from(doc.fileData), {
    headers: {
      'Content-Type': doc.mimeType || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(doc.fileName)}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}

// PUT /api/documents/file?id= — attach the original file (multipart field "file") to a document
export async function PUT(request: Request) {
  const userId = await getUserId()
  if (!userId) return error('Unauthorized', 401)
  const id = new URL(request.url).searchParams.get('id') ?? ''
  if (!OBJECT_ID.test(id)) return error('Document not found', 404)

  let file: FormDataEntryValue | null
  try {
    file = (await request.formData()).get('file')
  } catch {
    return error('Send the file as multipart form data')
  }
  if (!(file instanceof File)) return error('No file uploaded')
  if (!ALLOWED.test(file.name)) return error('Unsupported file type', 415)
  if (file.size > MAX_UPLOAD_BYTES) return error('File is too large (5 MB max)', 413)

  const owned = await prisma.userDocument.findFirst({ where: { id, userId }, select: { id: true } })
  if (!owned) return error('Document not found', 404)

  await prisma.userDocument.update({
    where: { id },
    data: { fileData: Buffer.from(await file.arrayBuffer()), mimeType: file.type || 'application/octet-stream' },
  })
  return json({ success: true })
}
