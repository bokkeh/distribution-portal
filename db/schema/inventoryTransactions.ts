import { pgTable, uuid, integer, text, timestamp } from 'drizzle-orm/pg-core'
import { products } from './products'
import { users } from './users'
import { orders } from './orders'

export const inventoryTransactions = pgTable('inventory_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
  orderId: uuid('order_id').references(() => orders.id, { onDelete: 'set null' }),
  type: text('type', {
    enum: ['product_created', 'manual_adjustment', 'sample_adjustment', 'order_allocation'],
  }).notNull(),
  reason: text('reason'),
  deltaPaid: integer('delta_paid').notNull().default(0),
  deltaSample: integer('delta_sample').notNull().default(0),
  deltaLooseBottlePaid: integer('delta_loose_bottle_paid').notNull().default(0),
  quantityPaidAfter: integer('quantity_paid_after').notNull().default(0),
  quantitySampleAfter: integer('quantity_sample_after').notNull().default(0),
  looseBottlePaidAfter: integer('loose_bottle_paid_after').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type InventoryTransaction = typeof inventoryTransactions.$inferSelect
export type NewInventoryTransaction = typeof inventoryTransactions.$inferInsert
