import { api, clearToken, DEFAULT_SERVER, fetchCvFile, getSettings, saveSettings } from './lib/api.js'

const $ = (id) => document.getElementById(id)
const show = (id, on = true) => ($(id).hidden = !on)

const STATUS = {
  SAVED: ['Saved', 250],
  APPLIED: ['Applied', 215],
  SCREENING: ['Screening', 290],
  INTERVIEW: ['Interview', 140],
  OFFER: ['Offer', 80],
  HIRED: ['Hired', 160],
  REJECTED: ['Rejected', 25],
}

const state = { tab: null, job: null, profile: null, app: null, recent: [], letter: '' }

function setError(message, where = 'error') {
  $(where).textContent = message || ''
  show(where, Boolean(message))
}

function sourceFor(url) {
  const host = new URL(url).hostname
  if (/linkedin\./.test(host)) return 'LINKEDIN'
  if (/indeed\./.test(host)) return 'INDEED'
  if (/glassdoor\./.test(host)) return 'GLASSDOOR'
  if (/themuse\./.test(host)) return 'THE_MUSE'
  if (/adzuna\./.test(host)) return 'ADZUNA'
  return 'COMPANY_SITE'
}

/** Runs fn(...args) inside the page (every frame) and returns the per-frame results. */
async function inPage(fn, args = []) {
  const results = await chrome.scripting.executeScript({ target: { tabId: state.tab.id, allFrames: true }, func: fn, args })
  return results.map((r) => r.result).filter((r) => r != null)
}

async function inject() {
  await chrome.scripting.executeScript({ target: { tabId: state.tab.id, allFrames: true }, files: ['content.js'] })
}

// ── Setup ──────────────────────────────────────────────────────

async function boot() {
  const { server, token } = await getSettings()
  $('server').value = server || DEFAULT_SERVER
  $('dashboard').href = `${server}/dashboard`
  if (!token) return showSetup()
  try {
    state.profile = (await api('/api/profile')).profile
  } catch (err) {
    return showSetup(err.message)
  }
  show('disconnect')
  show('main')
  await loadPage()
}

function showSetup(message) {
  show('main', false)
  show('disconnect', false)
  show('setup')
  setError(message, 'setup-error')
}

$('connect').addEventListener('click', async () => {
  const server = $('server').value.trim() || DEFAULT_SERVER
  const token = $('token').value.trim()
  if (!/^jh_/.test(token)) return setError('Paste the token from jobhunt Settings (it starts with jh_).', 'setup-error')
  await saveSettings({ server, token })
  show('setup', false)
  boot()
})

$('disconnect').addEventListener('click', async () => {
  await clearToken()
  showSetup()
})

// ── Page ───────────────────────────────────────────────────────

async function loadPage() {
  // popup.html?tab=<id> targets another tab (handy for debugging the popup in a full tab).
  const forced = Number(new URLSearchParams(location.search).get('tab'))
  ;[state.tab] = forced ? [await chrome.tabs.get(forced)] : await chrome.tabs.query({ active: true, currentWindow: true })
  if (!state.tab?.url || !/^https?:/.test(state.tab.url)) {
    $('loading').textContent = 'Open a job post or application form, then click jobhunt again.'
    return
  }

  try {
    await inject()
    const [job] = await inPage(() => window.__jobhuntApi?.extract())
    state.job = job || { url: state.tab.url, title: '', company: '', description: '', pageText: '', formFields: 0 }
    // Forms are often embedded in an iframe (Greenhouse, Lever, Workday): count fields in every frame.
    const counts = await inPage(() => window.__jobhuntApi?.countFields())
    state.job.formFields = counts.reduce((sum, n) => sum + (n || 0), 0)
  } catch {
    $('loading').textContent = 'This page can’t be read by extensions (for example the browser’s own pages).'
    return
  }

  // No structured job data: let the server read the page like a pasted post.
  if (!state.job.structured && state.job.pageText?.length > 80 && (!state.job.title || !state.job.company)) {
    try {
      const { job } = await api('/api/jobs/parse', { method: 'POST', json: { text: state.job.pageText } })
      state.job.title ||= job.jobTitle || ''
      state.job.company ||= job.company || ''
      state.job.location ||= job.location || ''
      state.job.deadline ||= job.deadline || ''
      state.job.applyUrl = job.applyUrl
    } catch {
      /* heuristics are best effort */
    }
  }

  const [{ applications: matches }, { applications: all }] = await Promise.all([
    api(`/api/applications?url=${encodeURIComponent(state.tab.url)}`),
    api('/api/applications'),
  ])
  state.app = matches[0] || null
  state.recent = all.filter((a) => a.status === 'SAVED').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 8)

  const { pendingByTab = {} } = await chrome.storage.session.get('pendingByTab')
  const pending = pendingByTab[state.tab.id]
  if (!state.app && pending) state.app = all.find((a) => a.id === pending.appId) || null

  render()
  if (pending && state.app?.status === 'SAVED') show('pending')
}

function render() {
  show('loading', false)
  show('job')
  show('letter-card')
  $('role').value = state.app?.jobTitle || state.job.title || ''
  $('company').value = state.app?.company || state.job.company || ''

  if (state.app) {
    const [label, hue] = STATUS[state.app.status] || ['Tracked', 250]
    $('chip').textContent = label
    $('chip').style.setProperty('--h', hue)
    show('chip')
    show('link-wrap', false)
    $('track').textContent = 'Tracked'
    $('track').disabled = true
  } else {
    show('chip', false)
    // Applying on a form page for a job you saved elsewhere (e.g. from a WhatsApp post)?
    const select = $('link')
    select.innerHTML = ''
    select.append(new Option('A new application', ''))
    for (const a of state.recent) select.append(new Option(`${a.company} · ${a.jobTitle}`, a.id))
    const guess = state.recent.find((a) => state.job.company && a.company.toLowerCase() === state.job.company.toLowerCase())
    if (guess) select.value = guess.id
    show('link-wrap', state.recent.length > 0)
  }

  const formHere = state.job.formFields > 0
  $('fill').disabled = !formHere
  $('fill').title = formHere ? '' : 'No form fields on this page'
  if (!formHere) $('fill').textContent = 'No form here'
  show('applied', Boolean(state.app && state.app.status === 'SAVED'))
}

/** The application this page belongs to, creating it (as Saved) if needed. */
async function ensureApp() {
  if (state.app) return state.app
  const linked = $('link').value && state.recent.find((a) => a.id === $('link').value)
  if (linked) {
    state.app = linked
    return linked
  }
  const company = $('company').value.trim()
  const role = $('role').value.trim()
  if (!company || !role) throw new Error('Add the role and company first.')
  const { application } = await api('/api/applications', {
    method: 'POST',
    json: {
      jobTitle: role,
      company,
      status: 'SAVED',
      source: sourceFor(state.tab.url),
      jobUrl: state.job.applyUrl || state.tab.url,
      location: state.job.location || null,
      description: state.job.description || null,
      salary: state.job.salary || null,
      jobType: state.job.jobType || null,
      deadline: state.job.deadline || null,
    },
  })
  state.app = application
  return application
}

$('track').addEventListener('click', async () => {
  setError('')
  $('track').disabled = true
  try {
    await ensureApp()
    render()
    $('result').textContent = `Saved to jobhunt. When you apply, it counts toward today’s goal.`
    show('result')
  } catch (err) {
    setError(err.message)
    $('track').disabled = false
  }
})

$('fill').addEventListener('click', async () => {
  setError('')
  const button = $('fill')
  button.disabled = true
  button.textContent = 'Filling…'
  try {
    const app = await ensureApp()
    await chrome.runtime.sendMessage({ type: 'link-tab', tabId: state.tab.id, appId: app.id, company: app.company, role: app.jobTitle })
    const cv = await fetchCvFile().catch(() => null)
    await inject()
    const results = await inPage((payload) => window.__jobhuntApi?.fill(payload), [{ profile: state.profile, coverLetter: state.letter, cv }])
    const filled = results.flatMap((r) => r.filled || [])
    const fields = filled.filter((f) => f !== 'cv').length
    const attached = results.some((r) => r.attached)
    render()
    $('result').textContent = filled.length
      ? `Filled ${fields} field${fields === 1 ? '' : 's'}${attached ? ' and attached your CV' : cv ? ' (attach your CV yourself here)' : ''}. Check everything, then click Submit on the page.`
      : 'Nothing to fill on this page. If the form opens on the next step, go there and click Fill again.'
    show('result')
    if (!cv) $('result').textContent += ' Tip: upload your CV as a PDF in jobhunt so it can be attached automatically.'
  } catch (err) {
    setError(err.message)
  } finally {
    button.textContent = 'Fill this form'
    button.disabled = !(state.job.formFields > 0)
  }
})

async function markApplied() {
  const res = await chrome.runtime.sendMessage({ type: 'mark-applied', appId: state.app.id })
  if (!res?.ok) throw new Error(res?.error || 'Couldn’t update jobhunt')
  state.app = { ...state.app, status: 'APPLIED' }
  show('pending', false)
  render()
  $('result').textContent = 'Marked as applied. Nice, that counts toward today’s goal.'
  show('result')
}

$('applied').addEventListener('click', () => markApplied().catch((err) => setError(err.message)))
$('pending-yes').addEventListener('click', () => markApplied().catch((err) => setError(err.message)))

// ── Cover letter ───────────────────────────────────────────────

$('write').addEventListener('click', async () => {
  setError('')
  const button = $('write')
  button.disabled = true
  button.textContent = 'Writing…'
  try {
    const { letter, mode } = await api('/api/ai/cover-letter', {
      method: 'POST',
      json: { jobTitle: $('role').value, company: $('company').value, description: state.app?.description || state.job.description },
    })
    state.letter = letter
    $('letter').value = letter
    show('letter')
    show('letter-actions')
    button.textContent = mode === 'template' ? 'From your template' : 'Rewrite'
  } catch (err) {
    setError(err.message)
    button.textContent = 'Write for this job'
  } finally {
    button.disabled = false
  }
})

$('letter').addEventListener('input', (e) => (state.letter = e.target.value))

$('insert').addEventListener('click', async () => {
  setError('')
  try {
    await inject()
    const results = await inPage((text) => window.__jobhuntApi?.insertCoverLetter(text), [state.letter])
    if (!results.some(Boolean)) throw new Error('No cover letter box on this page. Use Copy and paste it where it’s needed.')
    if (state.app) await api(`/api/applications/${state.app.id}`, { method: 'PATCH', json: { coverLetterUsed: state.letter } })
    $('insert').textContent = 'Inserted'
  } catch (err) {
    setError(err.message)
  }
})

$('copy').addEventListener('click', async () => {
  await navigator.clipboard.writeText(state.letter)
  $('copy').textContent = 'Copied'
})

boot()
