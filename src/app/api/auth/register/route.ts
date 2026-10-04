import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { error, json, readJson } from '@/lib/api'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(request: Request) {
  const body = await readJson(request)
  const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 80) : ''
  const email = typeof body?.email === 'string' ? body.email.toLowerCase().trim() : ''
  const password = typeof body?.password === 'string' ? body.password : ''

  if (!EMAIL.test(email)) return error('Enter a valid email address')
  if (password.length < 8) return error('Password must be at least 8 characters')
  if (password.length > 200) return error('Password is too long')

  try {
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return error(
        existing.password
          ? 'An account with this email already exists. Sign in instead.'
          : 'This email is linked to Google or GitHub. Use that button to sign in.',
        409
      )
    }

    const user = await prisma.user.create({
      data: {
        name: name || email.split('@')[0],
        email,
        password: await bcrypt.hash(password, 10),
      },
    })

    return json({ user: { id: user.id, name: user.name, email: user.email } }, 201)
  } catch (err) {
    console.error('Registration error:', err)
    return error('Could not create your account. Try again.', 500)
  }
}
