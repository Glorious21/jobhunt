// Injected on demand into the active tab (all frames) by the popup.
// Reads job details from the page and fills application forms. It never submits anything.
;(() => {
  if (window.__jobhuntApi) return

  const clean = (s) => (s || '').replace(/\s+/g, ' ').trim()
  const stripHtml = (html) => {
    const div = document.createElement('div')
    div.innerHTML = html || ''
    return div.innerText || div.textContent || ''
  }

  // ── Job extraction ──────────────────────────────────────────

  function fromJsonLd() {
    for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
      let data
      try {
        data = JSON.parse(script.textContent)
      } catch {
        continue
      }
      const items = [data, ...(Array.isArray(data) ? data : []), ...(data['@graph'] || [])].flat()
      const job = items.find((x) => x && (x['@type'] === 'JobPosting' || (Array.isArray(x['@type']) && x['@type'].includes('JobPosting'))))
      if (!job) continue
      const place = [].concat(job.jobLocation || [])[0]?.address || {}
      const location = [place.addressLocality, place.addressRegion, place.addressCountry?.name || place.addressCountry].filter(Boolean).join(', ')
      const salary = job.baseSalary?.value
      return {
        title: clean(job.title),
        company: clean(job.hiringOrganization?.name),
        location: job.jobLocationType === 'TELECOMMUTE' ? 'Remote' : clean(location),
        description: clean(stripHtml(job.description)).slice(0, 15000),
        jobType: [].concat(job.employmentType || [])[0] || '',
        salary: salary?.minValue && salary?.maxValue ? `${job.baseSalary.currency || ''} ${salary.minValue}–${salary.maxValue}`.trim() : '',
        deadline: job.validThrough || '',
      }
    }
    return null
  }

  const SELECTORS = {
    title: ['.job-details-jobs-unified-top-card__job-title', '.jobs-unified-top-card__job-title', '[data-testid="jobsearch-JobInfoHeader-title"]', '.posting-headline h2', '.app-title', '#header h1', 'h1'],
    company: ['.job-details-jobs-unified-top-card__company-name', '.jobs-unified-top-card__company-name', '[data-testid="inlineHeader-companyName"]', '[data-company-name]', '.company-name', '.posting-categories .sort-by-team'],
    location: ['.job-details-jobs-unified-top-card__bullet', '[data-testid="inlineHeader-companyLocation"]', '.posting-categories .location', '.location'],
  }
  const firstText = (list) => {
    for (const sel of list) {
      const el = document.querySelector(sel)
      const t = clean(el?.innerText)
      if (t && t.length < 160) return t
    }
    return ''
  }

  function extractJob() {
    const ld = fromJsonLd()
    const selection = clean(window.getSelection()?.toString())
    const main = document.querySelector('main, article, [role="main"]') || document.body
    // Page text with the heading first, for the server's job-post parser when there's no structured data.
    const heading = clean(document.querySelector('h1')?.innerText) || clean(document.title)
    const pageText = `${heading}\n${(main.innerText || '').slice(0, 15000)}`
    return {
      url: location.href,
      structured: Boolean(ld),
      title: ld?.title || firstText(SELECTORS.title),
      company: ld?.company || firstText(SELECTORS.company) || clean(document.querySelector('meta[property="og:site_name"]')?.content),
      location: ld?.location || firstText(SELECTORS.location),
      description: selection.length > 80 ? selection : ld?.description || clean(main.innerText).slice(0, 15000),
      jobType: ld?.jobType || '',
      salary: ld?.salary || '',
      deadline: ld?.deadline || '',
      pageText: selection.length > 80 ? selection : pageText,
      formFields: countFields(),
    }
  }

  // ── Form filling ────────────────────────────────────────────

  const visible = (el) => {
    const r = el.getBoundingClientRect()
    const st = getComputedStyle(el)
    return st.display !== 'none' && st.visibility !== 'hidden' && (r.width > 0 || r.height > 0)
  }

  function describe(el) {
    const parts = [el.name, el.id, el.placeholder, el.getAttribute('aria-label'), el.getAttribute('autocomplete'), el.getAttribute('data-automation-id')]
    if (el.id) {
      const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`)
      if (label) parts.push(label.innerText)
    }
    const wrapping = el.closest('label')
    if (wrapping) parts.push(wrapping.innerText)
    for (const id of (el.getAttribute('aria-labelledby') || '').split(/\s+/).filter(Boolean)) parts.push(document.getElementById(id)?.innerText)
    // Google Forms / generic question blocks: the heading of the enclosing question.
    const block = el.closest('[role="listitem"], .field, .form-group, .application-question, li, fieldset')
    if (block) parts.push(block.querySelector('[role="heading"], legend, label, .label, .application-label')?.innerText)
    return clean(parts.filter(Boolean).join(' | ')).toLowerCase().slice(0, 400)
  }

  const textInputs = () =>
    [...document.querySelectorAll('input, textarea')].filter(
      (el) => !el.disabled && !el.readOnly && visible(el) && (el.tagName === 'TEXTAREA' || ['text', 'email', 'tel', 'url', 'search', ''].includes((el.type || '').toLowerCase()))
    )
  const fileInputs = () => [...document.querySelectorAll('input[type="file"]')].filter((el) => !el.disabled)

  function countFields() {
    return textInputs().length + fileInputs().length
  }

  /** What a field is asking for, or null. Order matters: specific before general. */
  function classify(el, d) {
    const ac = (el.getAttribute('autocomplete') || '').toLowerCase()
    const map = { 'given-name': 'firstName', 'family-name': 'lastName', name: 'fullName', email: 'email', tel: 'phone', 'tel-national': 'phone', url: 'website', 'address-level2': 'city' }
    if (map[ac]) return map[ac]
    if (el.tagName === 'TEXTAREA' && /cover\s*letter|motivation|why .*(you|us|join|interested|apply)|tell us about yourself|additional information/.test(d)) return 'coverLetter'
    if (/linkedin/.test(d)) return 'linkedin'
    if (/github/.test(d)) return 'github'
    if (/e-?mail/.test(d) || el.type === 'email') return 'email'
    if (/first\s*name|given\s*name|fname|forename/.test(d)) return 'firstName'
    if (/last\s*name|surname|family\s*name|lname/.test(d)) return 'lastName'
    if (/(company|business|organi[sz]ation|employer|school|university|user)\s*name/.test(d)) return null
    if (/full\s*name|your name|applicant.?s? name|^name\b|\bname\b/.test(d)) return 'fullName'
    if (/phone|mobile|telephone|whatsapp|tel\b/.test(d) || el.type === 'tel') return 'phone'
    if (/portfolio|website|personal (site|url)|behance|dribbble/.test(d)) return 'website'
    if (/\bcity\b|location|where .*(based|located)|current address|state of residence/.test(d)) return 'city'
    return null
  }

  function setValue(el, value) {
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
    // Use the native setter so React/Vue-controlled inputs notice the change.
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
    el.dispatchEvent(new Event('blur', { bubbles: true }))
    flash(el)
  }

  function flash(el) {
    const prev = el.style.boxShadow
    el.style.transition = 'box-shadow .3s'
    el.style.boxShadow = '0 0 0 3px oklch(0.84 0.18 128)'
    setTimeout(() => (el.style.boxShadow = prev), 1800)
  }

  function attachFile(input, file) {
    const bytes = Uint8Array.from(atob(file.base64), (c) => c.charCodeAt(0))
    const dt = new DataTransfer()
    dt.items.add(new File([bytes], file.name, { type: file.type }))
    input.files = dt.files
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
    flash(input.closest('label, .field, div') || input)
  }

  function fill({ profile, coverLetter, cv }) {
    const [first, ...rest] = (profile.name || '').trim().split(/\s+/)
    const values = {
      firstName: first || '',
      lastName: rest.join(' '),
      fullName: profile.name || '',
      email: profile.email && !/@demo\.jobhunt\.local$/.test(profile.email) ? profile.email : '',
      phone: profile.phone || '',
      linkedin: profile.linkedinUrl || '',
      github: profile.githubUrl || '',
      website: profile.portfolioUrl || '',
      city: profile.targetLocation && !/remote/i.test(profile.targetLocation) ? profile.targetLocation : '',
      coverLetter: coverLetter || '',
    }
    const filled = []
    const used = new Set()
    for (const el of textInputs()) {
      if (el.value) continue // never overwrite what's already there
      const kind = classify(el, describe(el))
      if (!kind || !values[kind]) continue
      // Only one of each, except names split across fields.
      if (used.has(kind) && !['coverLetter'].includes(kind)) continue
      setValue(el, values[kind])
      used.add(kind)
      filled.push(kind)
    }

    let attached = false
    if (cv) {
      const inputs = fileInputs()
      const target =
        inputs.find((el) => /resume|cv\b|curriculum/.test(describe(el))) ||
        (inputs.length === 1 && !/image|photo|avatar/.test(describe(inputs[0]) + (inputs[0].accept || '')) ? inputs[0] : null)
      if (target && !target.files?.length) {
        try {
          attachFile(target, cv)
          attached = true
          filled.push('cv')
        } catch {
          /* some sites block programmatic files; the user can attach manually */
        }
      }
    }
    if (filled.length) watchSubmit()
    return { filled, attached, fields: countFields() }
  }

  function insertCoverLetter(text) {
    const target = textInputs().find((el) => el.tagName === 'TEXTAREA' && classify(el, describe(el)) === 'coverLetter') || textInputs().find((el) => el.tagName === 'TEXTAREA' && !el.value)
    if (!target) return false
    setValue(target, text)
    return true
  }

  // ── Submit detection ────────────────────────────────────────

  let watching = false
  function watchSubmit() {
    if (watching) return
    watching = true
    let sent = false
    const notify = () => {
      if (sent) return
      sent = true
      chrome.runtime.sendMessage({ type: 'submitted' }).catch(() => {})
      setTimeout(() => (sent = false), 10_000)
    }
    document.addEventListener('submit', notify, true)
    document.addEventListener(
      'click',
      (e) => {
        const btn = e.target.closest?.('button, input[type="submit"], [role="button"]')
        const label = clean(btn?.innerText || btn?.value || btn?.getAttribute?.('aria-label')).toLowerCase()
        if (btn && /^(submit|apply|send|submit application|send application|apply now|finish)\b/.test(label)) notify()
      },
      true
    )
  }

  // Called from the popup via chrome.scripting.executeScript, which returns one result per frame.
  window.__jobhuntApi = {
    extract: () => (window === window.top ? extractJob() : null),
    countFields,
    fill,
    insertCoverLetter,
  }
})()
