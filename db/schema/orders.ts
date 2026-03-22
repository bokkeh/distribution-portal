import { pgTable, uuid, text, numeric, timestamp } from 'drizzle-orm/pg-core'
import { customerAccounts } from './customers'
import { users } from './users'
import { products } from './products'
import { salesMembers } from './salesMembers'

export const orders = pgTable('orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  customerId: uuid('customer_id').notNull().references(() => customerAccounts.id),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  orderType: text('order_type', { enum: ['paid', 'sample'] }).notNull(),
  paymentTerms: text('payment_terms').default('NET30'),
  status: text('status', { enum: ['pending', 'confirmed', 'fulfilled', 'cancelled'] }).notNull().default('pending'),
  shippingStatus: text('shipping_status', { enum: ['not_scheduled', 'scheduled', 'out_for_delivery', 'delivered', 'issue'] }).notNull().default('not_scheduled'),
  subtotal: numeric('subtotal', { precision: 12, scale: 2 }).notNull().default('0'),
  tax: numeric('tax', { precision: 12, scale: 2 }).notNull().default('0'),
  total: numeric('total', { precision: 12, scale: 2 }).notNull().default('0'),
  notes: text('notes'),
  // Sales attribution
  attributedSalesMemberId: uuid('attributed_sales_member_id').references(() => salesMembers.id, { onDelete: 'set null' }),
  attributionSource: text('attribution_source', { enum: ['auto_assigned', 'manual', 'self_placed'] }),
  commissionStatus: text('commission_status', { enum: ['none', 'pending', 'calculated', 'approved', 'paid'] }).default('none'),
  commissionAmount: numeric('commission_amount', { precision: 12, scale: 2 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const orderItems = pgTable('order_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').notNull().references(() => products.id),
  quantity: numeric('quantity', { precision: 10, scale: 2 }).notNull(),
  unit: text('unit', { enum: ['case', 'bottle'] }).notNull().default('case'),
  unitPrice: numeric('unit_price', { precision: 10, scale: 2 }).notNull(),
  total: numeric('total', { precision: 12, scale: 2 }).notNull(),
})

export type Order = typeof orders.$inferSelect
export type NewOrder = typeof orders.$inferInsert
export type OrderItem = typeof orderItems.$inferSelect
export type NewOrderItem = typeof orderItems.$inferInsert
