import { pgTable, uuid, text, boolean, timestamp } from 'drizzle-orm/pg-core'
import { customerAccounts } from './customers'

export const contacts = pgTable('contacts', {
  id: uuid('id').primaryKey().defaultRandom(),
  customerId: uuid('customer_id').notNull().references(() => customerAccounts.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  email: text('email'),
  phone: text('phone'),
  title: text('title'),
  isPrimary: boolean('is_primary').notNull().default(false),
  hubspotContactId: text('hubspot_contact_id'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type Contact = typeof contacts.$inferSelect
export type NewContact = typeof contacts.$inferInsert
