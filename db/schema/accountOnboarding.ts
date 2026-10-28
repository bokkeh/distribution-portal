import { pgTable, uuid, text, integer, timestamp } from 'drizzle-orm/pg-core'
import { customerAccounts } from './customers'
import { contacts } from './contacts'

export const accountOnboarding = pgTable('account_onboarding', {
  accountId: uuid('account_id').primaryKey().references(() => customerAccounts.id, { onDelete: 'cascade' }),
  referralContactId: uuid('referral_contact_id').references(() => contacts.id, { onDelete: 'set null' }),
  referringAccountId: uuid('referring_account_id').references(() => customerAccounts.id, { onDelete: 'set null' }),
  requestedTerms: text('requested_terms'),
  status: text('status').notNull().default('new'),
  whatsappPhone: text('whatsapp_phone'),
  whatsappStatus: text('whatsapp_status').notNull().default('not_started'),
  notes: text('notes'),
  revision: integer('revision').notNull().default(1),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
