import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core'
import type { AnyPgColumn } from 'drizzle-orm/pg-core'
import { users } from './users'
import { commissionPlans } from './commissionPlans'

export const salesMembers = pgTable('sales_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  managerId: uuid('manager_id').references((): AnyPgColumn => salesMembers.id, { onDelete: 'set null' }),
  commissionPlanId: uuid('commission_plan_id').references(() => commissionPlans.id, { onDelete: 'set null' }),
  status: text('status', { enum: ['active', 'inactive', 'terminated'] }).notNull().default('active'),
  hireDate: text('hire_date'),
  homeRegion: text('home_region'),
  notes: text('notes'),
  onboardingStatus: text('onboarding_status', { enum: ['pending', 'in_progress', 'complete'] }).notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export type SalesMember = typeof salesMembers.$inferSelect
export type NewSalesMember = typeof salesMembers.$inferInsert
