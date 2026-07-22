import { pgTable, uuid, integer, text, timestamp } from 'drizzle-orm/pg-core'
import { products } from './products'
import { users } from './users'

export const inventorySampleHolders = pgTable('inventory_sample_holders', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  quantity: integer('quantity').notNull().default(1),
  looseBottleQuantity: integer('loose_bottle_quantity').notNull().default(0),
  notes: text('notes'),
  checkedOutAt: timestamp('checked_out_at', { withTimezone: true }).notNull().defaultNow(),
})

export type InventorySampleHolder = typeof inventorySampleHolders.$inferSelect
export type NewInventorySampleHolder = typeof inventorySampleHolders.$inferInsert
