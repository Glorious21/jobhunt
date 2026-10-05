import NextAuth, { CredentialsSignin } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import Google from 'next-auth/providers/google'
import GitHub from 'next-auth/providers/github'
import { PrismaAdapter } from '@auth/prisma-adapter'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { createDemoUser } from '@/lib/demo'

class InvalidLogin extends CredentialsSignin {
  code = 'invalid_credentials'
}

export const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
export const githubEnabled = Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET)

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'jwt' },
  trustHost: true,
  providers: [
    Credentials({
      id: 'credentials',
      name: 'Email',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const email = typeof credentials?.email === 'string' ? credentials.email.toLowerCase().trim() : ''
        const password = typeof credentials?.password === 'string' ? credentials.password : ''
        if (!email || !password) throw new InvalidLogin()

        const user = await prisma.user.findUnique({ where: { email } })
        // Accounts created through Google/GitHub have no password and can't use this form.
        if (!user?.password) throw new InvalidLogin()

        const valid = await bcrypt.compare(password, user.password)
        if (!valid) throw new InvalidLogin()

        return { id: user.id, email: user.email, name: user.name, image: user.image }
      },
    }),
    // Every demo sign-in gets a fresh, isolated account seeded with sample data.
    Credentials({
      id: 'demo',
      name: 'Demo',
      credentials: {},
      async authorize() {
        const user = await createDemoUser()
        return { id: user.id, email: user.email, name: user.name, image: null }
      },
    }),
    ...(googleEnabled
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            // Google verifies email ownership, so linking to an existing email account is safe.
            allowDangerousEmailAccountLinking: true,
            authorization: {
              params: {
                scope: 'openid email profile https://www.googleapis.com/auth/gmail.readonly',
                access_type: 'offline',
                prompt: 'consent',
              },
            },
          }),
        ]
      : []),
    ...(githubEnabled
      ? [
          GitHub({
            clientId: process.env.GITHUB_CLIENT_ID,
            clientSecret: process.env.GITHUB_CLIENT_SECRET,
          }),
        ]
      : []),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) token.id = user.id
      return token
    },
    async session({ session, token }) {
      if (session.user && token.id) session.user.id = token.id as string
      return session
    },
  },
  events: {
    // Auth.js only stores OAuth tokens the first time an account is linked. When someone
    // reconnects Google to grant Gmail access, save the new tokens and scope too.
    async signIn({ account }) {
      if (account?.provider !== 'google' || !account.access_token) return
      await prisma.account.updateMany({
        where: { provider: 'google', providerAccountId: account.providerAccountId },
        data: {
          access_token: account.access_token,
          expires_at: account.expires_at ?? null,
          scope: account.scope ?? null,
          token_type: account.token_type ?? null,
          id_token: account.id_token ?? null,
          // Google only sends a refresh token on consent; keep the old one otherwise.
          ...(account.refresh_token ? { refresh_token: account.refresh_token } : {}),
        },
      })
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
})
