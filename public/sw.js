// Minimal service worker: makes jobhunt installable (needed for "Share to jobhunt" on Android).
// It deliberately has no fetch handler and caches nothing, so the app always loads fresh data.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))
