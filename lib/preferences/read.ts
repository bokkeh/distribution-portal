import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { accountPreferences, customerAccounts, userPreferences } from '@/db/schema'
import { DEFAULT_TIME_ZONE } from '@/lib/timezones'

function isMissingPreferenceTable(error: unknown) {
  const code = (error as { code?: string; cause?: { code?: string } } | null)?.code
    ?? (error as { cause?: { code?: string } } | null)?.cause?.code
  const message = error instanceof Error ? error.message.toLowerCase() : ''
  return code === '42P01'
    || code === '42703'
    || message.includes('user_preferences')
    || message.includes('account_preferences')
    || message.includes('news_notifications_muted')
    || message.includes('news_digest_frequency')
    || message.includes('news_email_enabled')
    || message.includes('news_sms_enabled')
    || message.includes('news_in_app_enabled')
}

function buildDefaultUserPreferences(userId: string) {
  return {
    userId,
    timeZone: DEFAULT_TIME_ZONE,
    notificationPreference: 'all',
    emailNotificationsEnabled: true,
    smsNotificationsEnabled: true,
    inAppNotificationsEnabled: true,
    newsNotificationsMuted: false,
    newsDigestFrequency: 'important_only',
    newsEmailEnabled: true,
    newsSmsEnabled: false,
    newsInAppEnabled: true,
    quietHoursStart: null,
    quietHoursEnd: null,
    tasterOnboardingCompletedAt: null,
    driverOnboardingCompletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

export async function getUserPreferences(userId: string) {
  try {
    const [row] = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId)).limit(1)
    return row ?? buildDefaultUserPreferences(userId)
  } catch (error) {
    if (!isMissingPreferenceTable(error)) throw error
    return buildDefaultUserPreferences(userId)
  }
}

export async function getAccountPreferences(accountId: string, fallbackNotificationPreference?: string | null) {
  try {
    const [row] = await db.select().from(accountPreferences).where(eq(accountPreferences.accountId, accountId)).limit(1)
    return row ?? {
      accountId,
      timeZone: DEFAULT_TIME_ZONE,
      quietHoursStart: null,
      quietHoursEnd: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      notificationPreference: fallbackNotificationPreference ?? 'email',
    }
  } catch (error) {
    if (!isMissingPreferenceTable(error)) throw error
    return {
      accountId,
      timeZone: DEFAULT_TIME_ZONE,
      quietHoursStart: null,
      quietHoursEnd: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      notificationPreference: fallbackNotificationPreference ?? 'email',
    }
  }
}

export async function getCustomerAccountTimeZone(accountId: string) {
  const [account] = await db
    .select({ id: customerAccounts.id, notificationPreference: customerAccounts.notificationPreference })
    .from(customerAccounts)
    .where(eq(customerAccounts.id, accountId))
    .limit(1)

  if (!account) return DEFAULT_TIME_ZONE
  const preferences = await getAccountPreferences(account.id, account.notificationPreference)
  return preferences.timeZone ?? DEFAULT_TIME_ZONE
}
