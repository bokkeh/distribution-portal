import { pgTable, jsonb, uuid, text, timestamp, index } from 'drizzle-orm/pg-core'
import { contacts } from './contacts'
import { customerAccounts } from './customers'
import { users } from './users'

export const contactEmails = pgTable('contact_emails', {
  id: uuid('id').primaryKey(),
  contactId: uuid('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
  accountId: uuid('account_id').references(() => customerAccounts.id, { onDelete: 'set null' }),
  actorUserId: uuid('actor_user_id').notNull().references(() => users.id),
  sender: text('sender').notNull(),
  replyTo: text('reply_to'),
  recipient: text('recipient').notNull(),
  subject: text('subject').notNull(),
  body: text('body').notNull(),
  status: text('status', { enum: ['draft', 'queued', 'accepted', 'delivered', 'failed', 'unknown'] }).notNull().default('queued'),
  providerMessageId: text('provider_message_id'),
  error: text('error'),
  deliveryEvents: jsonb('delivery_events').$type<Array<{ id: string; type: string; at: string }>>().notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [index('contact_emails_contact_idx').on(table.contactId, table.createdAt), index('contact_emails_account_idx').on(table.accountId, table.createdAt)])
