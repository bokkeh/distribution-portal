'use server'

import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import { customerAccounts, drivers, users } from '@/db/schema'
import { requireAdmin } from '@/lib/auth/session'

const ALL_ROLES = ['admin', 'staff', 'driver', 'customer'] as const
type UserRole = typeof ALL_ROLES[number]

function parseRoles(formData: FormData, primaryRole: UserRole) {
  const selectedRoles = formData.getAll('roles').map(value => String(value)) as UserRole[]
  const nextRoles = new Set<UserRole>(selectedRoles.filter(role => ALL_ROLES.includes(role)))
  nextRoles.add(primaryRole)
  return Array.from(nextRoles)
}

export async function createUser(formData: FormData) {
  await requireAdmin()

  const name = formData.get('name') as string
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const role = formData.get('role') as UserRole
  const roles = parseRoles(formData, role)
  const phone = formData.get('phone') as string | null

  const passwordHash = await bcrypt.hash(password, 12)

  const [user] = await db.insert(users).values({
    name,
    email,
    passwordHash,
    role,
    roles,
    phone: phone || null,
  }).returning()

  if (roles.includes('customer')) {
    const companyName = formData.get('companyName') as string
    if (companyName) {
      await db.insert(customerAccounts).values({
        userId: user.id,
        companyName,
        contactName: formData.get('contactName') as string || null,
        address: formData.get('address') as string || null,
        city: formData.get('city') as string || null,
        state: formData.get('state') as string || null,
        zip: formData.get('zip') as string || null,
        phone: phone || null,
        email,
        dcAbraNumber: formData.get('dcAbraNumber') as string || null,
        creditLimit: formData.get('creditLimit') as string || '0',
        paymentTerms: formData.get('paymentTerms') as string || 'NET30',
      })
    }
  }

  if (roles.includes('driver')) {
    await db.insert(drivers).values({
      userId: user.id,
      phone: phone ?? '',
    })
  }

  revalidatePath('/admin/users')
  redirect('/admin/users')
}

export async function deactivateUser(userId: string) {
  await requireAdmin()
  await db.update(users).set({ active: false }).where(eq(users.id, userId))
  revalidatePath('/admin/users')
}

export async function activateUser(userId: string) {
  await requireAdmin()
  await db.update(users).set({ active: true }).where(eq(users.id, userId))
  revalidatePath('/admin/users')
}

export async function updateUserRole(
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  try {
    await requireAdmin()

    const userId = formData.get('userId') as string
    const role = formData.get('role') as UserRole
    const roles = parseRoles(formData, role)
    const phone = (formData.get('phone') as string | null) ?? ''

    await db.update(users).set({ role, roles }).where(eq(users.id, userId))

    if (roles.includes('driver')) {
      const [driver] = await db.select().from(drivers).where(eq(drivers.userId, userId)).limit(1)
      if (!driver) {
        await db.insert(drivers).values({ userId, phone })
      }
    }

    revalidatePath('/admin/users')
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) }
  }

  redirect(`/admin/users/${(formData.get('userId') as string)}`)
}
