import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core'

export const smsSubscriptions = pgTable('sms_subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  phoneNormalized: text('phone_normalized').notNull().unique(),
  status: text('status', { enum: ['subscribed', 'unsubscribed'] }).notNull().default('subscribed'),
  source: text('source').notNull().default('system'),
  consentLanguage: text('consent_language'),
  lastKeyword: text('last_keyword'),
  optedInAt: timestamp('opted_in_at', { withTimezone: true }),
  optedOutAt: timestamp('opted_out_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export type SmsSubscription = typeof smsSubscriptions.$inferSelect
export type NewSmsSubscription = typeof smsSubscriptions.$inferInsert
