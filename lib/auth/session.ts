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
  if (!roles.includes(session.user.role as string)) redirect('/unauthorized')
  return session
}

export async function requireAdmin() {
  return requireRole('admin')
}

export async function requireAdminOrStaff() {
  return requireRole('admin', 'staff')
}
