import NextAuth from 'next-auth'
import type { Provider } from 'next-auth/providers'
import Credentials from 'next-auth/providers/credentials'
import Google from 'next-auth/providers/google'
import bcrypt from 'bcryptjs'
import { db } from '@/db'
import { customerAccounts, users } from '@/db/schema'
import { eq } from 'drizzle-orm'

const providers: Provider[] = [
  Credentials({
    name: 'Credentials',
    credentials: {
      email: { label: 'Email', type: 'email' },
      password: { label: 'Password', type: 'password' },
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) return null

      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, credentials.email as string))
        .limit(1)

      if (!user || !user.active) return null

      const isValid = await bcrypt.compare(
        credentials.password as string,
        user.passwordHash
      )

      if (!isValid) return null

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        image: user.avatarUrl,
      }
    },
  }),
]

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    })
  )
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider !== 'google' || !user.email) {
        return true
      }

      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, user.email))
        .limit(1)

      if (existingUser) {
        if (!existingUser.active) return false

        user.id = existingUser.id
        ;(user as typeof user & { role: string }).role = existingUser.role
        user.name = existingUser.name
        user.image = existingUser.avatarUrl ?? user.image
        return true
      }

      const placeholderPassword = await bcrypt.hash(crypto.randomUUID(), 12)
      const displayName = user.name ?? (profile?.name as string | undefined) ?? user.email.split('@')[0]
      const avatarUrl = user.image ?? (profile?.picture as string | undefined) ?? null

      const [createdUser] = await db.insert(users).values({
        email: user.email,
        name: displayName,
        passwordHash: placeholderPassword,
        role: 'customer',
        avatarUrl,
        active: true,
      }).returning()

      await db.insert(customerAccounts).values({
        userId: createdUser.id,
        companyName: displayName,
        email: createdUser.email,
        phone: null,
        address: null,
        city: null,
        state: null,
        zip: null,
        creditLimit: '0',
        paymentTerms: 'NET30',
      })

      user.id = createdUser.id
      ;(user as typeof user & { role: string }).role = createdUser.role
      user.name = createdUser.name
      user.image = createdUser.avatarUrl
      return true
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as { role?: string }).role
      }

      if (token.email && !token.role) {
        const [dbUser] = await db.select().from(users).where(eq(users.email, token.email)).limit(1)
        if (dbUser) {
          token.id = dbUser.id
          token.role = dbUser.role
          token.picture = dbUser.avatarUrl ?? token.picture
          token.name = dbUser.name
        }
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string
        session.user.role = token.role as string
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 8 * 60 * 60, // 8 hours
  },
})
