import { pgTable, uuid, text, boolean, timestamp } from 'drizzle-orm/pg-core'

export const wholesaleAccountRequests = pgTable('wholesale_account_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessName: text('business_name').notNull(),
  businessEmail: text('business_email').notNull(),
  phone: text('phone'),
  phoneNormalized: text('phone_normalized'),
  smsOptIn: boolean('sms_opt_in').notNull().default(false),
  smsOptInAt: timestamp('sms_opt_in_at', { withTimezone: true }),
  smsConsentLanguage: text('sms_consent_language'),
  source: text('source').notNull().default('marketing_contact_form'),
  submissionPage: text('submission_page'),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type WholesaleAccountRequest = typeof wholesaleAccountRequests.$inferSelect
export type NewWholesaleAccountRequest = typeof wholesaleAccountRequests.$inferInsert
