import { pgTable, uuid, integer, timestamp } from 'drizzle-orm/pg-core'
import { products } from './products'

export const inventory = pgTable('inventory', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').notNull().unique().references(() => products.id, { onDelete: 'cascade' }),
  quantityPaid: integer('quantity_paid').notNull().default(0),
  quantitySample: integer('quantity_sample').notNull().default(0),
  looseBottlePaid: integer('loose_bottle_paid').notNull().default(0),
  reorderLevel: integer('reorder_level').notNull().default(10),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export type Inventory = typeof inventory.$inferSelect
export type NewInventory = typeof inventory.$inferInsert
