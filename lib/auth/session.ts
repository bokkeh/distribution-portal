import { auth } from './config'
import { redirect } from 'next/navigation'

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
