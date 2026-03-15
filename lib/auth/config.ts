import NextAuth from 'next-auth'
import type { Provider } from 'next-auth/providers'
import Credentials from 'next-auth/providers/credentials'
import Google from 'next-auth/providers/google'
import bcrypt from 'bcryptjs'
import { db } from '@/db'
import { customerAccounts, userFeatureSettings, users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { recordUserAccessEvent } from '@/lib/auth/activity'
import { resolveFeatureFlags } from '@/lib/users/features'

const SUPER_ADMIN_EMAIL = 'alex@ahawc.com'
const ADMIN_ROLE = 'admin'

function normalizeRoles(primaryRole: string, roles?: string[] | null) {
  const nextRoles = new Set((roles ?? []).filter(Boolean))
  nextRoles.add(primaryRole)
  return Array.from(nextRoles)
}

async function getFeatureFlags(userId: string, roles: string[]) {
  try {
    const [settings] = await db
      .select({ features: userFeatureSettings.features })
      .from(userFeatureSettings)
      .where(eq(userFeatureSettings.userId, userId))
      .limit(1)

    return resolveFeatureFlags(roles, settings?.features ?? null)
  } catch {
    return resolveFeatureFlags(roles, null)
  }
}

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
        roles: user.roles,
        featureFlags: await getFeatureFlags(user.id, user.roles),
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
  trustHost: true,
  events: {
    async signIn({ user, account }) {
      await recordUserAccessEvent({
        userId: user.id,
        eventType: 'login',
        provider: account?.provider ?? null,
      })
    },
    async signOut(message) {
      const userId =
        'token' in message
          ? typeof (message.token as { id?: string } | null)?.id === 'string'
            ? (message.token as { id: string }).id
            : null
          : null

      await recordUserAccessEvent({
        userId,
        eventType: 'logout',
        provider: null,
      })
    },
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider !== 'google' || !user.email) {
        return true
      }

      const normalizedEmail = user.email.toLowerCase()
      const isSuperAdmin = normalizedEmail === SUPER_ADMIN_EMAIL

      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, normalizedEmail))
        .limit(1)

      if (existingUser) {
        if (!existingUser.active) return false

        const effectiveUser = isSuperAdmin && !existingUser.roles.includes(ADMIN_ROLE)
          ? (await db.update(users)
              .set({
                role: ADMIN_ROLE,
                roles: normalizeRoles(ADMIN_ROLE, existingUser.roles),
                active: true,
              })
              .where(eq(users.id, existingUser.id))
              .returning())[0]
          : existingUser

        user.id = effectiveUser.id
        ;(user as typeof user & { role: string }).role = effectiveUser.role
        ;(user as typeof user & { roles: string[] }).roles = effectiveUser.roles
        ;(user as typeof user & { featureFlags: string[] }).featureFlags = await getFeatureFlags(effectiveUser.id, effectiveUser.roles)
        user.name = effectiveUser.name
        user.image = effectiveUser.avatarUrl ?? user.image
        return true
      }

      const placeholderPassword = await bcrypt.hash(crypto.randomUUID(), 12)
      const displayName = user.name ?? (profile?.name as string | undefined) ?? user.email.split('@')[0]
      const avatarUrl = user.image ?? (profile?.picture as string | undefined) ?? null

      const [createdUser] = await db.insert(users).values({
        email: normalizedEmail,
        name: displayName,
        passwordHash: placeholderPassword,
        role: isSuperAdmin ? ADMIN_ROLE : 'customer',
        roles: isSuperAdmin ? [ADMIN_ROLE] : ['customer'],
        avatarUrl,
        active: true,
      }).returning()

      if (!isSuperAdmin) {
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
      }

      user.id = createdUser.id
      ;(user as typeof user & { role: string }).role = createdUser.role
      ;(user as typeof user & { roles: string[] }).roles = createdUser.roles
      ;(user as typeof user & { featureFlags: string[] }).featureFlags = resolveFeatureFlags(createdUser.roles, null)
      user.name = createdUser.name
      user.image = createdUser.avatarUrl
      return true
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as { role?: string }).role
        token.roles = (user as { roles?: string[] }).roles
        token.featureFlags = (user as { featureFlags?: string[] }).featureFlags
        token.picture = user.image ?? token.picture
        token.name = user.name ?? token.name
      }

      if (token.id || (token.email && (!token.role || !token.roles || !token.featureFlags))) {
        const [dbUser] = token.id
          ? await db.select().from(users).where(eq(users.id, token.id as string)).limit(1)
          : await db.select().from(users).where(eq(users.email, token.email as string)).limit(1)

        if (dbUser) {
          token.id = dbUser.id
          token.role = dbUser.role
          token.roles = dbUser.roles
          token.featureFlags = await getFeatureFlags(dbUser.id, dbUser.roles)
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
        session.user.roles = (token.roles as string[] | undefined) ?? []
        session.user.featureFlags = (token.featureFlags as string[] | undefined) ?? []
        session.user.image = (token.picture as string | undefined) ?? session.user.image
        session.user.name = (token.name as string | undefined) ?? session.user.name
      }
      return session
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith('/')) return `${baseUrl}${url}`

      try {
        const nextUrl = new URL(url)
        if (nextUrl.origin === baseUrl) return url
      } catch {}

      return baseUrl
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 8 * 60 * 60, // 8 hours
  },
})
