// Shared by the popup and the background worker.
// Talks to your jobhunt server with a personal access token (Settings → Browser extension).

export const DEFAULT_SERVER = 'http://localhost:3000'

export async function getSettings() {
  const { server = DEFAULT_SERVER, token = '' } = await chrome.storage.local.get(['server', 'token'])
  return { server: server.replace(/\/+$/, ''), token }
}

export async function saveSettings({ server, token }) {
  await chrome.storage.local.set({ server: server.replace(/\/+$/, ''), token: token.trim() })
}

export async function clearToken() {
  await chrome.storage.local.remove('token')
}

/** JSON request to the jobhunt API. Throws Error(message) on failure. */
export async function api(path, { method = 'GET', json, raw = false } = {}) {
  const { server, token } = await getSettings()
  if (!token) throw new Error('Not connected')
  let res
  try {
    res = await fetch(`${server}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      body: json !== undefined ? JSON.stringify(json) : undefined,
    })
  } catch {
    throw new Error(`Can’t reach ${server}. Is jobhunt running?`)
  }
  if (raw) {
    if (!res.ok) throw new Error(`Request failed (${res.status})`)
    return res
  }
  const data = await res.json().catch(() => ({}))
  if (res.status === 401) throw new Error('Your token was revoked or is invalid. Create a new one in Settings.')
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
  return data
}

/** Latest CV with a stored file, as base64 (so it can be passed to the page). */
export async function fetchCvFile() {
  const { documents } = await api('/api/documents')
  const cv = documents.filter((d) => d.type === 'cv' && d.hasFile).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
  if (!cv) return null
  const res = await api(`/api/documents/file?id=${cv.id}`, { raw: true })
  const blob = await res.blob()
  const buffer = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  for (let i = 0; i < buffer.length; i += 0x8000) binary += String.fromCharCode(...buffer.subarray(i, i + 0x8000))
  const ext = (cv.mimeType || '').includes('pdf') ? '.pdf' : (cv.mimeType || '').includes('word') ? '.docx' : ''
  const name = /\.[a-z0-9]{2,5}$/i.test(cv.fileName) ? cv.fileName : `${cv.fileName}${ext}`
  return { name, type: cv.mimeType || blob.type || 'application/octet-stream', base64: btoa(binary) }
}
