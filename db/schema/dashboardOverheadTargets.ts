import { numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { users } from './users'

export const dashboardOverheadTargets = pgTable('dashboard_overhead_targets', {
  id: uuid('id').primaryKey().defaultRandom(),
  monthKey: text('month_key').notNull().unique(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  updatedByUserId: uuid('updated_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export type DashboardOverheadTarget = typeof dashboardOverheadTargets.$inferSelect
export type NewDashboardOverheadTarget = typeof dashboardOverheadTargets.$inferInsert
