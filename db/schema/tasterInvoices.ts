import { numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { tastings } from './tastings'
import { users } from './users'

export const tasterInvoices = pgTable('taster_invoices', {
  id: uuid('id').primaryKey().defaultRandom(),
  tastingId: uuid('tasting_id').notNull().unique().references(() => tastings.id, { onDelete: 'cascade' }),
  submittedByUserId: uuid('submitted_by_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  payeeName: text('payee_name').notNull(),
  payeeEmail: text('payee_email').notNull(),
  payeePhone: text('payee_phone'),
  hourlyRate: numeric('hourly_rate', { precision: 10, scale: 2 }).notNull().default('0'),
  hoursWorked: numeric('hours_worked', { precision: 10, scale: 2 }).notNull().default('0'),
  mileage: numeric('mileage', { precision: 10, scale: 2 }).notNull().default('0'),
  expenseAmount: numeric('expense_amount', { precision: 10, scale: 2 }).notNull().default('0'),
  totalAmount: numeric('total_amount', { precision: 10, scale: 2 }).notNull().default('0'),
  receiptUrls: text('receipt_urls').array().notNull().default([]),
  notes: text('notes'),
  status: text('status', { enum: ['submitted', 'approved', 'paid'] }).notNull().default('submitted'),
  submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow(),
})

export type TasterInvoice = typeof tasterInvoices.$inferSelect
export type NewTasterInvoice = typeof tasterInvoices.$inferInsert
