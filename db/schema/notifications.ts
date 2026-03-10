import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core'
import { users } from './users'

export const notificationsLog = pgTable('notifications_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  type: text('type', { enum: ['sms', 'email', 'chat'] }).notNull(),
  message: text('message').notNull(),
  status: text('status', { enum: ['sent', 'failed'] }).notNull().default('sent'),
  sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
})

export type NotificationLog = typeof notificationsLog.$inferSelect
export type NewNotificationLog = typeof notificationsLog.$inferInsert
