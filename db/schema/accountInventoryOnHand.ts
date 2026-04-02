import { index, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { customerAccounts } from './customers'
import { products } from './products'
import { users } from './users'

export const accountInventoryOnHand = pgTable('account_inventory_on_hand', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: uuid('account_id').notNull().references(() => customerAccounts.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  sku: text('sku').notNull(),
  productName: text('product_name').notNull(),
  unitType: text('unit_type'),
  casesOnHand: numeric('cases_on_hand', { precision: 10, scale: 2 }).notNull().default('0'),
  bottlesOnHand: numeric('bottles_on_hand', { precision: 10, scale: 2 }).notNull().default('0'),
  quantityOnHand: numeric('quantity_on_hand', { precision: 10, scale: 2 }).notNull().default('0'),
  updatedByUserId: uuid('updated_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  accountUpdatedIdx: index('account_inventory_on_hand_account_updated_idx').on(table.accountId, table.updatedAt),
  accountProductIdx: index('account_inventory_on_hand_account_product_idx').on(table.accountId, table.productId),
}))

export type AccountInventoryOnHand = typeof accountInventoryOnHand.$inferSelect
export type NewAccountInventoryOnHand = typeof accountInventoryOnHand.$inferInsert
