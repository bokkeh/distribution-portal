import { pgTable, uuid, text, numeric, timestamp } from 'drizzle-orm/pg-core'
import { users } from './users'

export const customerAccounts = pgTable('customer_accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  companyName: text('company_name').notNull(),
  address: text('address'),
  city: text('city'),
  state: text('state'),
  zip: text('zip'),
  phone: text('phone'),
  email: text('email'),
  hubspotContactId: text('hubspot_contact_id'),
  hubspotCompanyId: text('hubspot_company_id'),
  creditLimit: numeric('credit_limit', { precision: 12, scale: 2 }).notNull().default('0'),
  balance: numeric('balance', { precision: 12, scale: 2 }).notNull().default('0'),
  paymentTerms: text('payment_terms').default('NET30'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type CustomerAccount = typeof customerAccounts.$inferSelect
export type NewCustomerAccount = typeof customerAccounts.$inferInsert
