import { pgTable, uuid, text, numeric, timestamp } from 'drizzle-orm/pg-core'
import { salesMembers } from './salesMembers'
import { orders } from './orders'
import { users } from './users'

export const commissions = pgTable('commissions', {
  id: uuid('id').primaryKey().defaultRandom(),
  salesMemberId: uuid('sales_member_id').notNull().references(() => salesMembers.id),
  orderId: uuid('order_id').notNull().references(() => orders.id),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  status: text('status', { enum: ['pending', 'approved', 'paid', 'voided'] }).notNull().default('pending'),
  approvedByUserId: uuid('approved_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  stripePayoutId: text('stripe_payout_id'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type Commission = typeof commissions.$inferSelect
export type NewCommission = typeof commissions.$inferInsert
