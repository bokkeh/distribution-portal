import { auth } from './config'
import { redirect } from 'next/navigation'
import type { FeatureKey } from '@/lib/users/features'
import { hasFeature, resolveFeatureFlags } from '@/lib/users/features'
import { cookies } from 'next/headers'
import { db } from '@/db'
import { userFeatureSettings, users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import type { Session } from 'next-auth'
import {
  hasActiveViewAs,
  normalizeRoleList,
  parseViewAsRoles,
  VIEW_AS_COOKIE,
  VIEW_AS_ROLE_COOKIE,
  VIEW_AS_ROLES_COOKIE,
} from '@/lib/auth/view-as'

async function applyViewAs(session: Session): Promise<Session> {
  const roles = normalizeRoleList(session.user.role as string, session.user.roles)
  if (!roles.includes('admin')) return session

  try {
    const jar = await cookies()
    const viewAsUserId = jar.get(VIEW_AS_COOKIE)?.value
    const viewAsRole = jar.get(VIEW_AS_ROLE_COOKIE)?.value
    const viewAsRoles = parseViewAsRoles(jar.get(VIEW_AS_ROLES_COOKIE)?.value)
    if (!viewAsUserId || !hasActiveViewAs(viewAsUserId, viewAsRole, viewAsRoles)) return session

    const [target] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        roles: users.roles,
        features: userFeatureSettings.features,
      })
      .from(users)
      .leftJoin(userFeatureSettings, eq(userFeatureSettings.userId, users.id))
      .where(eq(users.id, viewAsUserId))
      .limit(1)

    if (!target) return session
    const targetRoles = normalizeRoleList(target.role, target.roles)

    return {
      ...session,
      user: {
        ...session.user,
        id: target.id,
        name: target.name,
        email: target.email,
        role: target.role,
        roles: targetRoles,
        featureFlags: resolveFeatureFlags(targetRoles, target.features ?? null),
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

export async function requireRole(...roles: string[]): Promise<Session> {
  const rawSession = await auth()
  if (!rawSession) redirect('/login')
  const session = rawSession as Session
  const realRoles = normalizeRoleList(session.user.role as string, session.user.roles)
  const effectiveSession = realRoles.includes('admin') ? await applyViewAs(session) : session
  const effectiveRoles = normalizeRoleList(effectiveSession.user.role as string, effectiveSession.user.roles)
  const isViewAsMode = effectiveSession.user.id !== session.user.id

  if (realRoles.includes('admin') && !isViewAsMode) {
    return effectiveSession
  }

  if (!effectiveRoles.some((role) => roles.includes(role))) redirect('/unauthorized')
  return effectiveSession
}

export async function requireAdmin() {
  const rawSession = await auth()
  if (!rawSession) redirect('/login')
  const session = rawSession as Session
  const realRoles = normalizeRoleList(session.user.role as string, session.user.roles)
  if (!realRoles.includes('admin')) redirect('/unauthorized')
  return session
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
