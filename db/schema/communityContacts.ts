import { index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { users } from './users'

export const communityContacts = pgTable('community_contacts', {
  id: uuid('id').primaryKey().defaultRandom(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  email: text('email').notNull(),
  phone: text('phone').notNull(),
  status: text('status', { enum: ['subscribed', 'unsubscribed'] }).notNull().default('subscribed'),
  source: text('source', { enum: ['public_signup', 'admin_entry', 'import'] }).notNull(),
  dealStage: text('deal_stage'),
  marketingConsentAt: timestamp('marketing_consent_at', { withTimezone: true }).notNull().defaultNow(),
  createdByUserId: uuid('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('community_contacts_email_uidx').on(table.email),
  index('community_contacts_status_idx').on(table.status),
  index('community_contacts_created_at_idx').on(table.createdAt),
])

export type CommunityContact = typeof communityContacts.$inferSelect
export type NewCommunityContact = typeof communityContacts.$inferInsert
