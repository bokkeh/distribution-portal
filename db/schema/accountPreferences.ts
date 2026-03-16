import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core'
import { customerAccounts } from './customers'

export const accountPreferences = pgTable('account_preferences', {
  accountId: uuid('account_id').primaryKey().references(() => customerAccounts.id, { onDelete: 'cascade' }),
  timeZone: text('time_zone').notNull().default('America/New_York'),
  quietHoursStart: text('quiet_hours_start'),
  quietHoursEnd: text('quiet_hours_end'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export type AccountPreference = typeof accountPreferences.$inferSelect
export type NewAccountPreference = typeof accountPreferences.$inferInsert
