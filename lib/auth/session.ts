import { auth } from './config'
import { redirect } from 'next/navigation'
import type { FeatureKey } from '@/lib/users/features'
import { hasFeature } from '@/lib/users/features'

export async function getSession() {
  return await auth()
}

export async function requireAuth() {
  const session = await auth()
  if (!session) redirect('/login')
  return session
}

export async function requireRole(...roles: string[]) {
  const session = await auth()
  if (!session) redirect('/login')
  const userRoles = session.user.roles ?? [session.user.role as string]
  if (userRoles.includes('admin')) return session
  if (!roles.some(role => userRoles.includes(role))) redirect('/unauthorized')
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
