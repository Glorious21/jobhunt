import { error, getUserId, json } from '@/lib/api'
import { extractText, MAX_UPLOAD_BYTES, UnsupportedFile } from '@/lib/extract-text'

// POST /api/documents/parse — multipart upload, returns the file's plain text.
// Nothing is stored here; the client saves the (editable) text via /api/documents.
export async function POST(request: Request) {
  const userId = await getUserId()
  if (!userId) return error('Unauthorized', 401)

  let file: FormDataEntryValue | null
  try {
    file = (await request.formData()).get('file')
  } catch {
    return error('Send the file as multipart form data')
  }
  if (!(file instanceof File)) return error('No file uploaded')
  if (file.size === 0) return error('That file is empty')
  if (file.size > MAX_UPLOAD_BYTES) return error('File is too large (5 MB max)', 413)

  try {
    const text = await extractText(file)
    if (text.length < 20) {
      return error('Couldn’t find any text in that file. If it’s a scanned PDF, export it as text or paste the content instead.', 422)
    }
    return json({ text: text.slice(0, 50000), fileName: file.name })
  } catch (err) {
    if (err instanceof UnsupportedFile) return error(err.message, 415)
    console.error('Document parse failed:', err)
    return error('Couldn’t read that file. It may be password-protected or corrupted.', 422)
  }
}
