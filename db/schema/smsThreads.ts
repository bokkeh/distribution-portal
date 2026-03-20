import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { customerAccounts } from './customers'
import { users } from './users'

export const smsThreads = pgTable('sms_threads', {
  id: uuid('id').primaryKey().defaultRandom(),
  phoneNumber: text('phone_number').notNull().unique(),
  customerId: uuid('customer_id').references(() => customerAccounts.id, { onDelete: 'set null' }),
  assignedUserId: uuid('assigned_user_id').references(() => users.id, { onDelete: 'set null' }),
  status: text('status', { enum: ['open', 'resolved'] }).notNull().default('open'),
  priority: text('priority', { enum: ['normal', 'starred'] }).notNull().default('normal'),
  groupParticipants: text('group_participants').array(),
  mutedUntil: timestamp('muted_until', { withTimezone: true }),
  lastMessageAt: timestamp('last_message_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export type SmsThread = typeof smsThreads.$inferSelect
export type NewSmsThread = typeof smsThreads.$inferInsert
