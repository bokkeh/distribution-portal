import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core'
import { salesMembers } from './salesMembers'

export const salesRegions = pgTable('sales_regions', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
  assignedManagerId: uuid('assigned_manager_id').references(() => salesMembers.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type SalesRegion = typeof salesRegions.$inferSelect
export type NewSalesRegion = typeof salesRegions.$inferInsert
