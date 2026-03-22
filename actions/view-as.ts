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

export async function searchAccountsForViewAs(query: string) {
  await requireSuperAdmin()
  const { db } = await import('@/db')
  const { customerAccounts } = await import('@/db/schema')
  const { ilike, isNotNull } = await import('drizzle-orm')

  if (!query.trim()) return []

  return db
    .select({ id: customerAccounts.id, companyName: customerAccounts.companyName, userId: customerAccounts.userId })
    .from(customerAccounts)
    .where(ilike(customerAccounts.companyName, `%${query}%`))
    .limit(6)
}

export async function startViewAsAccount(accountId: string): Promise<{ error?: string }> {
  await requireSuperAdmin()

  const { db } = await import('@/db')
  const { customerAccounts } = await import('@/db/schema')
  const { eq } = await import('drizzle-orm')

  const [account] = await db
    .select({ userId: customerAccounts.userId, companyName: customerAccounts.companyName })
    .from(customerAccounts)
    .where(eq(customerAccounts.id, accountId))
    .limit(1)

  if (!account) return { error: 'Account not found' }
  if (!account.userId) return { error: `${account.companyName} has no linked portal user. Ask the customer to register first.` }

  const jar = await cookies()
  jar.set(COOKIE_NAME, account.userId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60,
  })

  redirect('/customer/dashboard')
}
