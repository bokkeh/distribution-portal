'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth/config'

const COOKIE_NAME = '__portal_view_as'
const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL ?? ''

async function requireSuperAdmin() {
  const session = await auth()
  if (!session) redirect('/login')
  if (session.user.email?.toLowerCase() !== SUPER_ADMIN_EMAIL.toLowerCase()) {
    redirect('/unauthorized')
  }
  return session
}

export async function startViewAsUser(targetUserId: string): Promise<{ error?: string }> {
  await requireSuperAdmin()

  const [target] = await db
    .select({ id: users.id, name: users.name, email: users.email, roles: users.roles })
    .from(users)
    .where(eq(users.id, targetUserId))
    .limit(1)

  if (!target) return { error: 'User not found' }

  const jar = await cookies()
  jar.set(COOKIE_NAME, targetUserId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60, // 1 hour
  })

  // Redirect to the most relevant portal for the user's role
  const roles = target.roles ?? []
  if (roles.includes('sales_rep') || roles.includes('sales_manager')) {
    redirect('/sales/dashboard')
  }
  if (roles.includes('driver')) {
    redirect('/driver')
  }
  if (roles.includes('taster')) {
    redirect('/taster/tastings')
  }
  if (roles.includes('customer')) {
    redirect('/customer/dashboard')
  }
  if (roles.includes('staff')) {
    redirect('/staff')
  }
  redirect('/sales/dashboard')
}

export async function stopViewAsUser(): Promise<void> {
  const jar = await cookies()
  jar.delete(COOKIE_NAME)
  redirect('/admin/users')
}

export async function getViewAsUserId(): Promise<string | null> {
  const jar = await cookies()
  return jar.get(COOKIE_NAME)?.value ?? null
}
