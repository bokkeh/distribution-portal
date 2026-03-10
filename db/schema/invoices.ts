import { pgTable, uuid, text, numeric, date, timestamp } from 'drizzle-orm/pg-core'
import { customerAccounts } from './customers'
import { orders } from './orders'

export const invoices = pgTable('invoices', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').references(() => orders.id),
  customerId: uuid('customer_id').notNull().references(() => customerAccounts.id),
  invoiceNumber: text('invoice_number').notNull().unique(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  tax: numeric('tax', { precision: 12, scale: 2 }).notNull().default('0'),
  total: numeric('total', { precision: 12, scale: 2 }).notNull(),
  status: text('status', { enum: ['draft', 'sent', 'paid', 'overdue'] }).notNull().default('draft'),
  dueDate: date('due_date'),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  stripePaymentIntentId: text('stripe_payment_intent_id'),
  pdfUrl: text('pdf_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type Invoice = typeof invoices.$inferSelect
export type NewInvoice = typeof invoices.$inferInsert
