import { index, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { customerAccounts } from './customers'
import { accountInventoryOnHand } from './accountInventoryOnHand'
import { products } from './products'
import { users } from './users'
import { orders } from './orders'

export const accountInventoryAdjustments = pgTable('account_inventory_adjustments', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: uuid('account_id').notNull().references(() => customerAccounts.id, { onDelete: 'cascade' }),
  inventoryItemId: uuid('inventory_item_id').references(() => accountInventoryOnHand.id, { onDelete: 'set null' }),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  sourceOrderId: uuid('source_order_id').references(() => orders.id),
  sku: text('sku').notNull(),
  productName: text('product_name').notNull(),
  changeType: text('change_type', { enum: ['manual_add', 'manual_update', 'manual_remove', 'manual_edit', 'order_fulfillment'] }).notNull(),
  // Legacy compatibility columns; bottle-only history keeps both case values at zero.
  deltaCases: numeric('delta_cases', { precision: 10, scale: 2 }).notNull().default('0'),
  deltaBottles: numeric('delta_bottles', { precision: 10, scale: 2 }).notNull().default('0'),
  // Absolute physical count for manual checks; null for additive events such as fulfilled orders.
  recordedBottlesOnHand: numeric('recorded_bottles_on_hand', { precision: 10, scale: 2 }),
  resultingCasesOnHand: numeric('resulting_cases_on_hand', { precision: 10, scale: 2 }).notNull().default('0'),
  resultingBottlesOnHand: numeric('resulting_bottles_on_hand', { precision: 10, scale: 2 }).notNull().default('0'),
  effectiveAt: timestamp('effective_at', { withTimezone: true }).notNull().defaultNow(),
  notes: text('notes'),
  createdByUserId: uuid('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  updatedByUserId: uuid('updated_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  accountEffectiveIdx: index('account_inventory_adjustments_account_effective_idx').on(table.accountId, table.effectiveAt),
  accountProductEffectiveIdx: index('account_inventory_adjustments_account_product_effective_idx').on(table.accountId, table.productId, table.effectiveAt),
  sourceOrderProductIdx: uniqueIndex('account_inventory_adjustments_source_order_product_uidx').on(table.sourceOrderId, table.productId),
}))

export type AccountInventoryAdjustment = typeof accountInventoryAdjustments.$inferSelect
export type NewAccountInventoryAdjustment = typeof accountInventoryAdjustments.$inferInsert
