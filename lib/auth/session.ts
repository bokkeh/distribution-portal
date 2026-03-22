import { auth } from './config'
import { redirect } from 'next/navigation'
import type { FeatureKey } from '@/lib/users/features'
import { hasFeature } from '@/lib/users/features'
import { cookies } from 'next/headers'
import { db } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import type { Session } from 'next-auth'

const VIEW_AS_COOKIE = '__portal_view_as'
const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL ?? ''

async function applyViewAs(session: Session): Promise<Session> {
  // Only superadmin can use view-as
  if (session.user.email?.toLowerCase() !== SUPER_ADMIN_EMAIL.toLowerCase()) return session

  try {
    const jar = await cookies()
    const viewAsUserId = jar.get(VIEW_AS_COOKIE)?.value
    if (!viewAsUserId) return session

    const [target] = await db
      .select({ id: users.id, name: users.name, email: users.email, role: users.role, roles: users.roles })
      .from(users)
      .where(eq(users.id, viewAsUserId))
      .limit(1)

    if (!target) return session

    // Return a shallow copy with the viewed user's identity overlaid
    return {
      ...session,
      user: {
        ...session.user,
        id: target.id,
        name: target.name,
        email: target.email,
        role: target.role,
        roles: target.roles,
        // Keep original admin email in a separate field for the banner
        _viewingAsOf: session.user.email,
      } as Session['user'],
    } as Session
  } catch {
    return session
  }
}

export async function getSession() {
  return await auth()
}

export async function requireAuth(): Promise<Session> {
  const rawSession = await auth()
  if (!rawSession) redirect('/login')
  return rawSession as Session
}

function mergeRoles(role: string | null | undefined, rolesArr: string[] | null | undefined): string[] {
  const combined = [...(rolesArr ?? []), ...(role ? [role] : [])]
  return [...new Set(combined.filter(Boolean))]
}

export async function requireRole(...roles: string[]): Promise<Session> {
  const rawSession = await auth()
  if (!rawSession) redirect('/login')
  const session = rawSession as Session
  const realRoles = mergeRoles(session.user.role as string, session.user.roles)
  if (realRoles.includes('admin')) {
    // Admin always passes — apply view-as overlay if active so pages see the target user's data
    const effective = await applyViewAs(session)
    return effective
  }
  if (!realRoles.some(role => roles.includes(role))) redirect('/unauthorized')
  return session
}

export async function requireAdmin() {
  return requireRole('admin')
}

export async function requireAdminOrStaff() {
  return requireRole('admin', 'staff')
}

export async function requireFeature(feature: FeatureKey, ...roles: string[]) {
  const session = roles.length ? await requireRole(...roles) : await requireAuth()
  const userRoles = session.user.roles ?? [session.user.role as string]
  const featureFlags = session.user.featureFlags ?? []

  if (!hasFeature(feature, userRoles, featureFlags)) {
    redirect('/unauthorized')
  }

  return session
}
