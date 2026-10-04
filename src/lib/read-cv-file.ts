// Client helper: turn an uploaded CV file into plain text.

export const CV_ACCEPT = '.pdf,.docx,.doc,.rtf,.txt,.md,.markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,text/plain'
const ALLOWED = /\.(pdf|docx|doc|rtf|txt|md|markdown)$/i
const MAX_BYTES = 5 * 1024 * 1024

export async function readCvFile(file: File): Promise<string> {
  if (!ALLOWED.test(file.name)) throw new Error('Upload a PDF, Word (.docx / .doc), RTF or text file.')
  if (file.size > MAX_BYTES) throw new Error('File is too large (5 MB max).')

  // Plain text needs no server round-trip.
  if (/\.(txt|md|markdown)$/i.test(file.name)) return (await file.text()).trim()

  const body = new FormData()
  body.append('file', file)
  const res = await fetch('/api/documents/parse', { method: 'POST', body })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Couldn’t read that file')
  return data.text as string
}

/** "Jane_Doe_CV.pdf" → "Jane_Doe_CV" */
export function baseName(fileName: string) {
  return fileName.replace(/\.[^.]+$/, '')
}

/** Stores the original file with a document, so the browser extension can attach it to forms. */
export async function uploadDocumentFile(documentId: string, file: File) {
  const body = new FormData()
  body.append('file', file)
  const res = await fetch(`/api/documents/file?id=${documentId}`, { method: 'PUT', body })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || 'Couldn’t store the file')
  }
}
