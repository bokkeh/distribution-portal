import { date, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core'
import { users } from './users'

export const tasterAvailability = pgTable('taster_availability', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  availableDate: date('available_date').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export type TasterAvailability = typeof tasterAvailability.$inferSelect
export type NewTasterAvailability = typeof tasterAvailability.$inferInsert
