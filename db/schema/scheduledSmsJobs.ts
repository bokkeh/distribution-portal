import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { tastings } from './tastings'
import { users } from './users'

export const scheduledSmsJobs = pgTable('scheduled_sms_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  tastingId: uuid('tasting_id').references(() => tastings.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  templateKey: text('template_key').notNull(),
  phoneNumber: text('phone_number').notNull(),
  payload: jsonb('payload').notNull().default({}),
  sendAt: timestamp('send_at', { withTimezone: true }).notNull(),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  status: text('status', { enum: ['pending', 'sent', 'failed', 'cancelled'] }).notNull().default('pending'),
  lastError: text('last_error'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type ScheduledSmsJob = typeof scheduledSmsJobs.$inferSelect
