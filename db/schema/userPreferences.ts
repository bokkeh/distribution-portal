import { pgTable, uuid, text, boolean, timestamp } from 'drizzle-orm/pg-core'
import { users } from './users'

export const userPreferences = pgTable('user_preferences', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  timeZone: text('time_zone').notNull().default('America/New_York'),
  notificationPreference: text('notification_preference').notNull().default('all'),
  emailNotificationsEnabled: boolean('email_notifications_enabled').notNull().default(true),
  smsNotificationsEnabled: boolean('sms_notifications_enabled').notNull().default(true),
  inAppNotificationsEnabled: boolean('in_app_notifications_enabled').notNull().default(true),
  newsNotificationsMuted: boolean('news_notifications_muted').notNull().default(false),
  newsDigestFrequency: text('news_digest_frequency').notNull().default('important_only'),
  newsEmailEnabled: boolean('news_email_enabled').notNull().default(true),
  newsSmsEnabled: boolean('news_sms_enabled').notNull().default(false),
  newsInAppEnabled: boolean('news_in_app_enabled').notNull().default(true),
  quietHoursStart: text('quiet_hours_start'),
  quietHoursEnd: text('quiet_hours_end'),
  tasterOnboardingCompletedAt: timestamp('taster_onboarding_completed_at', { withTimezone: true }),
  driverOnboardingCompletedAt: timestamp('driver_onboarding_completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export type UserPreference = typeof userPreferences.$inferSelect
export type NewUserPreference = typeof userPreferences.$inferInsert
