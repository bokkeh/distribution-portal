import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { userPreferences, users } from '@/db/schema'
import { getUserPreferences } from '@/lib/preferences/read'

/**
 * Check whether a specific user has email notifications enabled.
 * Returns true if no userId is provided (can't check → default to send).
 */
export async function checkEmailEnabled(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return true
  const prefs = await getUserPreferences(userId)
  return prefs.emailNotificationsEnabled
}

/**
 * Check whether a specific user has SMS notifications enabled.
 * Returns true if no userId is provided (can't check → default to send).
 */
export async function checkSmsEnabled(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return true
  const prefs = await getUserPreferences(userId)
  return prefs.smsNotificationsEnabled
}

/**
 * Return the email addresses of all active portal users matching the given
 * roles whose email notifications are enabled.
 *
 * Deduplicates results. If a user has no preference record, they are included
 * (default = enabled).
 */
export async function getStaffEmailsForNotification(
  roles: string[] = ['admin', 'staff'],
): Promise<string[]> {
  const rows = await db
    .select({
      email: users.email,
      roles: users.roles,
      active: users.active,
      emailEnabled: userPreferences.emailNotificationsEnabled,
    })
    .from(users)
    .leftJoin(userPreferences, eq(users.id, userPreferences.userId))

  const emails = rows
    .filter(
      (r) =>
        r.active &&
        roles.some((role) => r.roles.includes(role)) &&
        (r.emailEnabled ?? true),
    )
    .map((r) => r.email)
    .filter(Boolean) as string[]

  return [...new Set(emails)]
}

/**
 * Return the phone numbers of all active portal users matching the given
 * roles whose SMS notifications are enabled and who have a phone on file.
 *
 * Deduplicates results. If a user has no preference record, they are included
 * (default = enabled).
 */
export async function getStaffPhonesForNotification(
  roles: string[] = ['admin', 'staff'],
): Promise<string[]> {
  const rows = await db
    .select({
      phone: users.phone,
      roles: users.roles,
      active: users.active,
      smsEnabled: userPreferences.smsNotificationsEnabled,
    })
    .from(users)
    .leftJoin(userPreferences, eq(users.id, userPreferences.userId))

  const phones = rows
    .filter(
      (r) =>
        r.active &&
        r.phone &&
        roles.some((role) => r.roles.includes(role)) &&
        (r.smsEnabled ?? true),
    )
    .map((r) => r.phone)
    .filter(Boolean) as string[]

  return [...new Set(phones)]
}
