'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import { customerAccounts, users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth/config'
import {
  getDashboardForRoles,
  serializeViewAsRoles,
  VIEW_AS_COOKIE,
  VIEW_AS_ROLE_COOKIE,
  VIEW_AS_ROLES_COOKIE,
} from '@/lib/auth/view-as'

async function requireAdmin() {
  const session = await auth()
  if (!session) redirect('/login')
  const roles = session.user.roles ?? (session.user.role ? [session.user.role] : [])
  if (!roles.includes('admin')) {
    redirect('/unauthorized')
  }
  return session
}

function getCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 60 * 60,
  }
}

export async function startViewAsUser(targetUserId: string, preferredRole?: string): Promise<{ error?: string }> {
  await requireAdmin()

  const [target] = await db
    .select({ id: users.id, name: users.name, email: users.email, role: users.role, roles: users.roles })
    .from(users)
    .where(eq(users.id, targetUserId))
    .limit(1)

  if (!target) return { error: 'User not found' }

  const jar = await cookies()
  const roles = Array.from(new Set([...(target.roles ?? []), ...(target.role ? [target.role] : [])].filter(Boolean)))
  const selectedRole = preferredRole && roles.includes(preferredRole) ? preferredRole : target.role
  const cookieOptions = getCookieOptions()
  jar.set(VIEW_AS_COOKIE, targetUserId, cookieOptions)
  jar.set(VIEW_AS_ROLE_COOKIE, selectedRole, cookieOptions)
  jar.set(VIEW_AS_ROLES_COOKIE, serializeViewAsRoles(roles), cookieOptions)

  redirect(getDashboardForRoles(roles, selectedRole))
}

export async function stopViewAsUser(): Promise<void> {
  const jar = await cookies()
  jar.delete(VIEW_AS_COOKIE)
  jar.delete(VIEW_AS_ROLE_COOKIE)
  jar.delete(VIEW_AS_ROLES_COOKIE)
  redirect('/admin/users')
}

export async function getViewAsUserId(): Promise<string | null> {
  const jar = await cookies()
  return jar.get(VIEW_AS_COOKIE)?.value ?? null
}

export async function searchAccountsForViewAs(query: string) {
  await requireAdmin()

  if (!query.trim()) return []

  const { ilike } = await import('drizzle-orm')

  return db
    .select({ id: customerAccounts.id, companyName: customerAccounts.companyName, userId: customerAccounts.userId })
    .from(customerAccounts)
    .where(ilike(customerAccounts.companyName, `%${query}%`))
    .limit(6)
}

export async function startViewAsAccount(accountId: string): Promise<{ error?: string }> {
  await requireAdmin()

  const [account] = await db
    .select({
      userId: customerAccounts.userId,
      companyName: customerAccounts.companyName,
      role: users.role,
      roles: users.roles,
    })
    .from(customerAccounts)
    .leftJoin(users, eq(customerAccounts.userId, users.id))
    .where(eq(customerAccounts.id, accountId))
    .limit(1)

  if (!account) return { error: 'Account not found' }
  if (!account.userId) return { error: `${account.companyName} has no linked portal user. Ask the customer to register first.` }

  const jar = await cookies()
  const roles = Array.from(new Set([...(account.roles ?? []), ...(account.role ? [account.role] : [])].filter(Boolean)))
  const cookieOptions = getCookieOptions()
  jar.set(VIEW_AS_COOKIE, account.userId, cookieOptions)
  jar.set(VIEW_AS_ROLE_COOKIE, account.role, cookieOptions)
  jar.set(VIEW_AS_ROLES_COOKIE, serializeViewAsRoles(roles), cookieOptions)

  redirect(getDashboardForRoles(roles, account.role))
}
