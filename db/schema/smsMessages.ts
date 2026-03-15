import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { users } from './users'

export const smsMessages = pgTable('sms_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id),
  direction: text('direction', { enum: ['inbound', 'outbound'] }).notNull(),
  phoneNumber: text('phone_number').notNull(),
  contactName: text('contact_name'),
  body: text('body').notNull(),
  mediaUrls: text('media_urls').array(),
  status: text('status', { enum: ['received', 'sent', 'failed'] }).notNull(),
  providerMessageId: text('provider_message_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type SmsMessage = typeof smsMessages.$inferSelect
export type NewSmsMessage = typeof smsMessages.$inferInsert
