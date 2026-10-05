import type { MetadataRoute } from 'next'

// Installable app. On Android, once installed, jobhunt appears in the system share sheet:
// share a job post from WhatsApp/Telegram/Chrome and it opens as a filled-in application.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'jobhunt',
    short_name: 'jobhunt',
    description: 'Run your job search like a pipeline.',
    id: '/',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    background_color: '#f6f7f4',
    theme_color: '#1E4A3A',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    share_target: {
      action: '/dashboard/share',
      method: 'GET',
      params: { title: 'title', text: 'text', url: 'url' },
    },
    shortcuts: [
      { name: 'Add application', url: '/dashboard?add=1' },
      { name: 'Applications', url: '/dashboard/applications' },
    ],
  }
}
