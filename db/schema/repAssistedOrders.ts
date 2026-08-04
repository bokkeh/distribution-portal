import { boolean, index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { customerAccounts } from './customers'
import { invoices } from './invoices'
import { orders } from './orders'
import { salesMembers } from './salesMembers'
import { users } from './users'

export const REP_ASSISTED_ORDER_STATUSES = [
  'draft',
  'pending_crm',
  'ready_to_send',
  'sent',
  'viewed',
  'awaiting_payment',
  'paid',
  'failed',
  'cancelled',
  'expired',
] as const

export const repAssistedOrders = pgTable('rep_assisted_orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  idempotencyKey: text('idempotency_key').notNull(),
  orderId: uuid('order_id').unique().references(() => orders.id, { onDelete: 'cascade' }),
  invoiceId: uuid('invoice_id').unique().references(() => invoices.id, { onDelete: 'cascade' }),
  customerId: uuid('customer_id').references(() => customerAccounts.id, { onDelete: 'cascade' }),
  salesMemberId: uuid('sales_member_id').references(() => salesMembers.id, { onDelete: 'set null' }),
  createdByUserId: uuid('created_by_user_id').notNull().references(() => users.id),
  status: text('status', { enum: REP_ASSISTED_ORDER_STATUSES }).notNull().default('ready_to_send'),
  recipientEmail: text('recipient_email').notNull().default(''),
  recipientPhone: text('recipient_phone').notNull().default(''),
  draftData: jsonb('draft_data').notNull().default({}),
  customerFacingNotes: text('customer_facing_notes'),
  internalNotes: text('internal_notes'),
  purchaseOrderNumber: text('purchase_order_number'),
  requestedDeliveryDate: text('requested_delivery_date'),
  shippingAddress: text('shipping_address'),
  billingAddress: text('billing_address'),
  accessTokenHash: text('access_token_hash').notNull(),
  accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }).notNull(),
  accessTokenUsedAt: timestamp('access_token_used_at', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  emailStatus: text('email_status', { enum: ['pending', 'sent', 'failed'] }).notNull().default('pending'),
  emailSentAt: timestamp('email_sent_at', { withTimezone: true }),
  smsStatus: text('sms_status', { enum: ['pending', 'sent', 'failed'] }).notNull().default('pending'),
  smsSentAt: timestamp('sms_sent_at', { withTimezone: true }),
  linkOpenedAt: timestamp('link_opened_at', { withTimezone: true }),
  invoiceViewedAt: timestamp('invoice_viewed_at', { withTimezone: true }),
  paymentCompletedAt: timestamp('payment_completed_at', { withTimezone: true }),
  notificationErrors: jsonb('notification_errors').notNull().default({}),
  resendHistory: jsonb('resend_history').notNull().default([]),
  termsAccepted: boolean('terms_accepted').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('rep_assisted_orders_idempotency_key_idx').on(table.idempotencyKey),
  uniqueIndex('rep_assisted_orders_access_token_hash_idx').on(table.accessTokenHash),
  index('rep_assisted_orders_sales_member_idx').on(table.salesMemberId, table.createdAt),
  index('rep_assisted_orders_customer_idx').on(table.customerId, table.createdAt),
])

export type RepAssistedOrder = typeof repAssistedOrders.$inferSelect
export type NewRepAssistedOrder = typeof repAssistedOrders.$inferInsert
