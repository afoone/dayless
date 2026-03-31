import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'

// We use raw SQL via a fresh PrismaClient to avoid stale module cache
// that might not include the User model (added after initial server start)
async function findUser(email: string) {
  const { PrismaClient } = await import('@prisma/client')
  const prisma = new PrismaClient()
  try {
    const rows = await prisma.$queryRawUnsafe(
      'SELECT id, email, password, name, avatar FROM "User" WHERE email = ? LIMIT 1',
      email
    ) as any[]
    return rows[0] || null
  } finally {
    await prisma.$disconnect()
  }
}

async function createUser(email: string, hashedPassword: string, name: string) {
  const { PrismaClient } = await import('@prisma/client')
  const prisma = new PrismaClient()
  try {
    const id = 'usr_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)
    const now = new Date().toISOString()
    await prisma.$executeRawUnsafe(
      'INSERT INTO "User" (id, email, password, name, "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?, ?)',
      id, email, hashedPassword, name, now, now
    )
    return { id, email, name, avatar: null }
  } finally {
    await prisma.$disconnect()
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email', placeholder: 'tu@email.com' },
        password: { label: 'Contraseña', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const email = credentials.email.toLowerCase().trim()

        // Find user
        let user = await findUser(email)

        if (!user) {
          // Auto-create user on first login (password must be >= 6 chars)
          if (credentials.password.length < 6) return null
          const hashedPassword = await bcrypt.hash(credentials.password, 12)
          try {
            const name = email.split('@')[0]
            user = await createUser(email, hashedPassword, name)
          } catch {
            return null
          }
        }

        if (!user) return null

        // Verify password
        const isPasswordValid = await bcrypt.compare(credentials.password, user.password)
        if (!isPasswordValid) {
          return null
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.avatar,
        }
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.email = user.email
        token.name = user.name
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.email = token.email as string
        session.user.name = token.name as string
      }
      return session
    },
  },
  pages: {
    signIn: '/',
  },
  secret: process.env.NEXTAUTH_SECRET || 'dayless-ai-secret-change-in-production',
}
