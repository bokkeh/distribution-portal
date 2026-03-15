import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { customerAccounts } from './customers'
import { users } from './users'

export const tastings = pgTable('tastings', {
  id: uuid('id').primaryKey().defaultRandom(),
  customerId: uuid('customer_id').notNull().references(() => customerAccounts.id, { onDelete: 'cascade' }),
  assignedUserId: uuid('assigned_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdByUserId: uuid('created_by_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  eventName: text('event_name').notNull(),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
  endAt: timestamp('end_at', { withTimezone: true }),
  checkedInAt: timestamp('checked_in_at', { withTimezone: true }),
  status: text('status', { enum: ['scheduled', 'confirmed', 'completed', 'cancelled'] }).notNull().default('scheduled'),
  storeAddress: text('store_address'),
  storeCity: text('store_city'),
  storeState: text('store_state'),
  storeZip: text('store_zip'),
  storePhone: text('store_phone'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type Tasting = typeof tastings.$inferSelect
export type NewTasting = typeof tastings.$inferInsert
