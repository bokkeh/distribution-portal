import { pgTable, uuid, text, numeric, jsonb, timestamp } from 'drizzle-orm/pg-core'

export const commissionPlans = pgTable('commission_plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  type: text('type', { enum: ['flat_case', 'percent_revenue', 'tiered'] }).notNull(),
  ratePerCase: numeric('rate_per_case', { precision: 10, scale: 2 }),
  revenuePercent: numeric('revenue_percent', { precision: 5, scale: 2 }),
  tiers: jsonb('tiers').$type<Array<{ minCases: number; maxCases: number | null; rate: number }>>(),
  active: text('active').notNull().default('true'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type CommissionPlan = typeof commissionPlans.$inferSelect
export type NewCommissionPlan = typeof commissionPlans.$inferInsert
