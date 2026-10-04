import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Onboarding from './Onboarding'

export const metadata: Metadata = { title: 'Set up' }

export default async function OnboardingPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { onboarded: true, name: true, email: true } })
  if (!user) redirect('/api/session/clear')
  if (user.onboarded) redirect('/dashboard')
  // Sign-up derives a placeholder name from the email; don't prefill that.
  const placeholder = user.email ? user.email.split('@')[0] : ''
  return <Onboarding name={user.name && user.name !== placeholder ? user.name : ''} />
}
