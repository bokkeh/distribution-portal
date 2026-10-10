import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core'
import { customerAccounts } from './customers'
import { users } from './users'
import { orders } from './orders'
import { invoices } from './invoices'

// A request is committed atomically with its new order/invoice. No historical rows are rewritten.
export const fieldDocuments = pgTable('field_documents', {
  id: uuid('id').primaryKey(),
  accountId: uuid('account_id').notNull().references(() => customerAccounts.id),
  createdByUserId: uuid('created_by_user_id').notNull().references(() => users.id),
  kind: text('kind', { enum: ['order', 'invoice'] }).notNull(),
  fingerprint: text('fingerprint').notNull(),
  orderId: uuid('order_id').references(() => orders.id),
  invoiceId: uuid('invoice_id').notNull().references(() => invoices.id),
  paymentMethod: text('payment_method', { enum: ['check', 'cod', 'stripe'] }).notNull(),
  recipientEmail: text('recipient_email').notNull(),
  emailSentAt: timestamp('email_sent_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [index('field_documents_account_idx').on(table.accountId, table.createdAt)])
