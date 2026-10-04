import { api } from './lib/api.js'

// When you click Submit on a form the extension filled, the page tells us here.
// We ask (via a notification) before marking the job applied — a click on Submit
// doesn't always mean the application went through.

const KEY = 'pendingByTab'

async function getPending() {
  return (await chrome.storage.session.get(KEY))[KEY] ?? {}
}

async function setPending(map) {
  await chrome.storage.session.set({ [KEY]: map })
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  ;(async () => {
    if (msg?.type === 'link-tab') {
      // Popup: this tab is filling the application for appId.
      const map = await getPending()
      map[msg.tabId] = { appId: msg.appId, company: msg.company, role: msg.role }
      await setPending(map)
      sendResponse({ ok: true })
    } else if (msg?.type === 'submitted' && sender.tab?.id != null) {
      const map = await getPending()
      const link = map[sender.tab.id]
      if (link) {
        chrome.notifications.create(`apply:${link.appId}`, {
          type: 'basic',
          iconUrl: 'icons/icon128.png',
          title: `Did your ${link.company} application go through?`,
          message: 'Mark it as applied in jobhunt. It counts toward today’s goal.',
          buttons: [{ title: 'Mark applied' }, { title: 'Not yet' }],
          requireInteraction: true,
        })
      }
      sendResponse({ ok: Boolean(link) })
    } else if (msg?.type === 'mark-applied') {
      try {
        await markApplied(msg.appId)
        sendResponse({ ok: true })
      } catch (err) {
        sendResponse({ ok: false, error: err.message })
      }
    }
  })()
  return true // async response
})

async function markApplied(appId) {
  const { application } = await api(`/api/applications/${appId}`, { method: 'PATCH', json: { status: 'APPLIED' } })
  const map = await getPending()
  for (const [tab, link] of Object.entries(map)) if (link.appId === appId) delete map[tab]
  await setPending(map)
  return application
}

chrome.notifications.onButtonClicked.addListener(async (id, button) => {
  if (!id.startsWith('apply:')) return
  chrome.notifications.clear(id)
  if (button !== 0) return
  try {
    const app = await markApplied(id.slice('apply:'.length))
    chrome.notifications.create({ type: 'basic', iconUrl: 'icons/icon128.png', title: 'Marked as applied', message: `${app.company} · ${app.jobTitle} is in your pipeline.` })
  } catch (err) {
    chrome.notifications.create({ type: 'basic', iconUrl: 'icons/icon128.png', title: 'Couldn’t update jobhunt', message: err.message })
  }
})

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const map = await getPending()
  if (map[tabId]) {
    delete map[tabId]
    await setPending(map)
  }
})
