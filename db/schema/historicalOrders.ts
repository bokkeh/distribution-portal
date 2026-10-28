import { index, integer, uniqueIndex, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { customerAccounts } from './customers'
import { products } from './products'
import { users } from './users'

/**
 * Pre-system / backfilled order history for reconciled CRM history and economics. Deliberately isolated
 * from the live `orders` table, which drives fulfillment, inventory sync, notifications, and
 * commissions — a historical entry must never trigger any of that.
 */
export const historicalOrders = pgTable('historical_orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: uuid('account_id').notNull().references(() => customerAccounts.id, { onDelete: 'cascade' }),
  orderDate: timestamp('order_date', { withTimezone: true }).notNull(),
  productId: uuid('product_id').references(() => products.id, { onDelete: 'set null' }),
  productNameFreeform: text('product_name_freeform'),
  cases: numeric('cases', { precision: 10, scale: 2 }).notNull().default('0'),
  bottles: numeric('bottles', { precision: 10, scale: 2 }).notNull().default('0'),
  orderValue: numeric('order_value', { precision: 12, scale: 2 }),
  caseUnitPrice: numeric('case_unit_price', { precision: 12, scale: 2 }),
  bottleUnitPrice: numeric('bottle_unit_price', { precision: 12, scale: 2 }),
  externalReference: text('external_reference'),
  paymentStatus: text('payment_status'),
  fulfillmentStatus: text('fulfillment_status'),
  fingerprint: text('fingerprint'),
  duplicateReviewReason: text('duplicate_review_reason'),
  revision: integer('revision').notNull().default(1),
  notes: text('notes'),
  source: text('source', { enum: ['imported', 'manual_historical', 'legacy_system'] }).notNull().default('manual_historical'),
  createdByUserId: uuid('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  fingerprintIdx: uniqueIndex('historical_orders_fingerprint_uidx').on(table.fingerprint),
  accountOrderDateIdx: index('historical_orders_account_order_date_idx').on(table.accountId, table.orderDate),
}))

export type HistoricalOrder = typeof historicalOrders.$inferSelect
export type NewHistoricalOrder = typeof historicalOrders.$inferInsert
