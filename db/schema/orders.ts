import { boolean, index, pgTable, uuid, text, numeric, timestamp } from 'drizzle-orm/pg-core'
import { customerAccounts } from './customers'
import { users } from './users'
import { products } from './products'
import { salesMembers } from './salesMembers'
import { geographicPricingRules } from './geographicPricingRules'
import { tastings } from './tastings'

export const ORDER_PAYMENT_STATUSES = ['not_applicable', 'unpaid', 'requires_action', 'processing', 'paid', 'failed', 'canceled'] as const
export type OrderPaymentStatus = typeof ORDER_PAYMENT_STATUSES[number]
export const ORDER_PAYMENT_METHODS = ['stripe', 'check', 'cod', 'manual'] as const
export type OrderPaymentMethod = typeof ORDER_PAYMENT_METHODS[number]

export const orders = pgTable('orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  customerId: uuid('customer_id').notNull().references(() => customerAccounts.id),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  orderType: text('order_type', { enum: ['paid', 'sample'] }).notNull(),
  paymentTerms: text('payment_terms').default('NET30'),
  stripePaymentIntentId: text('stripe_payment_intent_id'),
  paymentStatus: text('payment_status', { enum: ORDER_PAYMENT_STATUSES }).notNull().default('unpaid'),
  paymentMethod: text('payment_method', { enum: ORDER_PAYMENT_METHODS }),
  paidAt: timestamp('paid_at', { withTimezone: true }),
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
  isAssisted: boolean('is_assisted').notNull().default(false),
  assistedByUserId: uuid('assisted_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  assistanceType: text('assistance_type'),
  relatedTastingId: uuid('related_tasting_id').references(() => tastings.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('orders_related_tasting_idx').on(table.relatedTastingId),
  index('orders_assisted_by_idx').on(table.assistedByUserId, table.createdAt),
])

export const orderItems = pgTable('order_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').notNull().references(() => products.id),
  quantity: numeric('quantity', { precision: 10, scale: 2 }).notNull(),
  unit: text('unit', { enum: ['case', 'bottle'] }).notNull().default('case'),
  unitPrice: numeric('unit_price', { precision: 10, scale: 2 }).notNull(),
  total: numeric('total', { precision: 12, scale: 2 }).notNull(),
  pricingSource: text('pricing_source', { enum: ['account_special', 'county_override', 'business_type_price', 'state_price', 'default_price'] }),
  pricingRuleId: uuid('pricing_rule_id').references(() => geographicPricingRules.id, { onDelete: 'set null' }),
  pricingState: text('pricing_state'),
  pricingCounty: text('pricing_county'),
})

export type Order = typeof orders.$inferSelect
export type NewOrder = typeof orders.$inferInsert
export type OrderItem = typeof orderItems.$inferSelect
export type NewOrderItem = typeof orderItems.$inferInsert
