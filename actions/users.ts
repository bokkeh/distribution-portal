'use server'

import { randomBytes } from 'crypto'
import bcrypt from 'bcryptjs'
import { and, eq, isNull } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import { customerAccounts, drivers, userFeatureSettings, userPreferences, users } from '@/db/schema'
import { requireAdmin } from '@/lib/auth/session'
import { notify } from '@/lib/notifications/dispatch'

const ALL_ROLES = ['admin', 'staff', 'driver', 'customer', 'taster', 'sales_rep', 'sales_manager'] as const
type UserRole = typeof ALL_ROLES[number]
const WELCOME_ELIGIBLE_ROLES: UserRole[] = ['driver', 'customer', 'taster', 'sales_rep', 'sales_manager']

function generateTemporaryPassword() {
  return `AHAWC-${randomBytes(6).toString('hex')}`
}

function parseRoles(formData: FormData, primaryRole: UserRole) {
  const selectedRoles = formData.getAll('roles').map(value => String(value)) as UserRole[]
  const nextRoles = new Set<UserRole>(selectedRoles.filter(role => ALL_ROLES.includes(role)))
  nextRoles.add(primaryRole)
  return Array.from(nextRoles)
}

function parseFeatures(formData: FormData) {
  return formData.getAll('features').map(value => String(value)).filter(Boolean)
}

function formatRoleLabel(role: UserRole) {
  return role.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase())
}

function isMissingUserFeatureTable(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()
  return message.includes('user_feature_settings') && message.includes('does not exist')
}

export async function createUser(formData: FormData) {
  await requireAdmin()

  const name = formData.get('name') as string
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const role = formData.get('role') as UserRole
  const roles = parseRoles(formData, role)
  const phone = formData.get('phone') as string | null
  const features = parseFeatures(formData)
  const existingCustomerAccountId = String(formData.get('existingCustomerAccountId') ?? '').trim()
  const requestedCompanyName = String(formData.get('companyName') ?? '').trim()

  if (roles.includes('customer') && existingCustomerAccountId) {
    const [account] = await db
      .select({ userId: customerAccounts.userId })
      .from(customerAccounts)
      .where(eq(customerAccounts.id, existingCustomerAccountId))
      .limit(1)
    if (!account) throw new Error('The selected CRM account does not exist.')
    if (account.userId) throw new Error('The selected CRM account is already linked to a portal user.')
  }
  if (roles.includes('customer') && !existingCustomerAccountId && !requestedCompanyName) {
    throw new Error('Select an existing CRM account or enter a company name for a customer user.')
  }

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
    const companyName = requestedCompanyName
    if (existingCustomerAccountId) {
      await db.update(customerAccounts).set({
        userId: user.id,
        email: email.toLowerCase(),
        contactName: (formData.get('contactName') as string) || name,
        phone: phone || null,
      }).where(and(eq(customerAccounts.id, existingCustomerAccountId), isNull(customerAccounts.userId)))
    } else if (companyName) {
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
        paymentTerms: formData.get('paymentTerms') as string || 'PREPAID',
      })
    }
  }

  if (roles.includes('driver')) {
    await db.insert(drivers).values({
      userId: user.id,
      phone: phone ?? '',
    })
  }

  if (features.length > 0) {
    try {
      await db.insert(userFeatureSettings).values({
        userId: user.id,
        features,
      })
    } catch (error) {
      if (!isMissingUserFeatureTable(error)) throw error
    }
  }

  if (WELCOME_ELIGIBLE_ROLES.includes(role)) {
    await notify('user.welcomed', {
      name: user.name,
      email: user.email,
      phone: user.phone,
      password,
      role: formatRoleLabel(role),
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
    const features = parseFeatures(formData)

    await db.update(users).set({ role, roles }).where(eq(users.id, userId))

    if (roles.includes('driver')) {
      const [driver] = await db.select().from(drivers).where(eq(drivers.userId, userId)).limit(1)
      if (!driver) {
        await db.insert(drivers).values({ userId, phone })
      }
    }

    try {
      const [existingSettings] = await db
        .select({ id: userFeatureSettings.id })
        .from(userFeatureSettings)
        .where(eq(userFeatureSettings.userId, userId))
        .limit(1)

      if (existingSettings) {
        await db.update(userFeatureSettings).set({
          features,
        }).where(eq(userFeatureSettings.userId, userId))
      } else {
        await db.insert(userFeatureSettings).values({
          userId,
          features,
        })
      }
    } catch (error) {
      if (!isMissingUserFeatureTable(error)) throw error
    }

    revalidatePath('/admin/users')
    revalidatePath(`/admin/users/${userId}`)
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) }
  }

  redirect(`/admin/users/${(formData.get('userId') as string)}`)
}

export async function updateUserProfile(
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  try {
    await requireAdmin()

    const userId = formData.get('userId') as string
    await db.update(users).set({
      name: formData.get('name') as string,
      email: formData.get('email') as string,
      phone: (formData.get('phone') as string) || null,
      avatarUrl: (formData.get('avatarUrl') as string) || null,
    }).where(eq(users.id, userId))

    revalidatePath('/admin/users')
    revalidatePath(`/admin/users/${userId}`)
    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
}

export async function updateUserNotificationPreferences(
  _prev: { error?: string; success?: boolean } | null,
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  try {
    await requireAdmin()

    const userId = formData.get('userId') as string
    const emailNotificationsEnabled = formData.get('emailNotificationsEnabled') === 'on'
    const smsNotificationsEnabled = formData.get('smsNotificationsEnabled') === 'on'
    const inAppNotificationsEnabled = formData.get('inAppNotificationsEnabled') === 'on'
    const notificationPreference = (formData.get('notificationPreference') as string) || 'all'

    await db.insert(userPreferences).values({
      userId,
      emailNotificationsEnabled,
      smsNotificationsEnabled,
      inAppNotificationsEnabled,
      notificationPreference,
      updatedAt: new Date(),
    }).onConflictDoUpdate({
      target: userPreferences.userId,
      set: {
        emailNotificationsEnabled,
        smsNotificationsEnabled,
        inAppNotificationsEnabled,
        notificationPreference,
        updatedAt: new Date(),
      },
    })

    revalidatePath(`/admin/users/${userId}`)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
}

export async function setTasterHourlyRate(
  _prev: { error?: string; success?: boolean } | null,
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  try {
    await requireAdmin()
    const userId = formData.get('userId') as string
    const rate = (formData.get('tasterHourlyRate') as string) || '0'
    await db.update(users).set({ tasterHourlyRate: rate }).where(eq(users.id, userId))
    revalidatePath(`/admin/users/${userId}`)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
}

export async function resetUserPassword(
  _prev: { error?: string; success?: boolean; temporaryPassword?: string } | null,
  formData: FormData
): Promise<{ error?: string; success?: boolean; temporaryPassword?: string }> {
  try {
    await requireAdmin()

    const userId = formData.get('userId') as string
    const rawPassword = formData.get('newPassword')
    const customPassword = typeof rawPassword === 'string' && rawPassword.trim().length > 0
      ? rawPassword
      : null
    const temporaryPassword = customPassword ?? generateTemporaryPassword()

    if (temporaryPassword.length < 8) {
      return { error: 'Password must be at least 8 characters.' }
    }

    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)

    if (!user) {
      return { error: 'User not found.' }
    }

    const passwordHash = await bcrypt.hash(temporaryPassword, 12)

    await db.update(users).set({ passwordHash }).where(eq(users.id, userId))

    revalidatePath('/admin/users')
    revalidatePath(`/admin/users/${userId}`)

    return { success: true, temporaryPassword }
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
}
