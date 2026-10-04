import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AppDataProvider } from '@/components/AppData'
import AppShell from '@/components/AppShell'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { onboarded: true },
  })
  // Session cookie for a user that no longer exists (e.g. deleted account).
  if (!user) redirect('/api/session/clear')
  if (!user.onboarded) redirect('/onboarding')

  return (
    <AppDataProvider>
      <AppShell>{children}</AppShell>
    </AppDataProvider>
  )
}
