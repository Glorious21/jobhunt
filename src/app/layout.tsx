import type { Metadata, Viewport } from 'next'
import { Bricolage_Grotesque, Geist, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import Providers from '@/components/Providers'

// Variable font with the optical-size axis, so large headings get the tighter display cut.
const bricolage = Bricolage_Grotesque({ subsets: ['latin'], axes: ['opsz'], variable: '--font-bricolage' })
const geist = Geist({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-geist' })
const jetbrains = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-jetbrains' })

export const metadata: Metadata = {
  title: {
    default: 'jobhunt — Run your job search like a pipeline',
    template: '%s · jobhunt',
  },
  description:
    'Track every application, hit a daily goal, tailor your CV to each posting and see which channels actually get replies.',
}

export const viewport: Viewport = {
  themeColor: '#f6f7f4',
}

// Applies the saved theme before first paint to avoid a flash. Light is the default;
// "system" and "dark" are opt-ins from Settings (the dark theme isn't designed yet).
const themeScript = `try{var t=localStorage.getItem('theme');document.documentElement.dataset.theme=(t==='system'||t==='dark')?t:'light'}catch(e){document.documentElement.dataset.theme='light'}`

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${bricolage.variable} ${geist.variable} ${jetbrains.variable}`} data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
