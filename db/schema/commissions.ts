import { pgTable, uuid, text, numeric, timestamp, boolean } from 'drizzle-orm/pg-core'
import { salesMembers } from './salesMembers'
import { orders } from './orders'
import { users } from './users'
import { customerAccounts } from './customers'

export const commissions = pgTable('commissions', {
  id: uuid('id').primaryKey().defaultRandom(),
  salesMemberId: uuid('sales_member_id').notNull().references(() => salesMembers.id),
  orderId: uuid('order_id').references(() => orders.id, { onDelete: 'set null' }),
  accountId: uuid('account_id').references(() => customerAccounts.id, { onDelete: 'set null' }),
  type: text('type', { enum: ['order_based', 'manual_bonus', 'adjustment', 'spiff', 'penalty'] }).notNull().default('order_based'),
  isManual: boolean('is_manual').notNull().default(false),
  source: text('source', { enum: ['system', 'admin_manual'] }).notNull().default('system'),
  description: text('description'),
  reasonCode: text('reason_code'),
  adjustmentReferenceId: uuid('adjustment_reference_id'),
  createdByAdminId: uuid('created_by_admin_id').references(() => users.id, { onDelete: 'set null' }),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  status: text('status', { enum: ['pending', 'approved', 'paid', 'voided'] }).notNull().default('pending'),
  approvedByUserId: uuid('approved_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  effectiveDate: timestamp('effective_date', { withTimezone: true }),
  stripePayoutId: text('stripe_payout_id'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type Commission = typeof commissions.$inferSelect
export type NewCommission = typeof commissions.$inferInsert
