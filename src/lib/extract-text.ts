// Server-only: pull plain text out of uploaded CV files.

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024
export const ACCEPTED_EXTENSIONS = ['.pdf', '.docx', '.doc', '.txt', '.md', '.markdown', '.rtf'] as const

export class UnsupportedFile extends Error {}

function extension(name: string) {
  const i = name.lastIndexOf('.')
  return i === -1 ? '' : name.slice(i).toLowerCase()
}

function tidy(text: string) {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t ]+\n/g, '\n')
    .replace(/[ \t ]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function stripRtf(rtf: string) {
  return rtf
    .replace(/\\par[d]?/g, '\n')
    .replace(/\{\\\*[^{}]*\}/g, '')
    .replace(/\\'[0-9a-f]{2}/gi, '')
    .replace(/\\[a-z]+-?\d* ?/gi, '')
    .replace(/[{}]/g, '')
}

export async function extractText(file: File): Promise<string> {
  const ext = extension(file.name)
  const buffer = Buffer.from(await file.arrayBuffer())

  switch (ext) {
    case '.pdf': {
      const { extractText: pdfText, getDocumentProxy } = await import('unpdf')
      const pdf = await getDocumentProxy(new Uint8Array(buffer))
      const { text } = await pdfText(pdf, { mergePages: true })
      return tidy(text)
    }
    case '.docx': {
      const mammoth = await import('mammoth')
      const { value } = await mammoth.extractRawText({ buffer })
      return tidy(value)
    }
    case '.doc': {
      const { default: WordExtractor } = await import('word-extractor')
      const doc = await new WordExtractor().extract(buffer)
      return tidy(doc.getBody())
    }
    case '.rtf':
      return tidy(stripRtf(buffer.toString('utf8')))
    case '.txt':
    case '.md':
    case '.markdown':
      return tidy(buffer.toString('utf8'))
    default:
      throw new UnsupportedFile('Upload a PDF, Word (.docx / .doc), RTF or text file.')
  }
}
