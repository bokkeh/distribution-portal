import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { customerAccounts } from './customers'
import { users } from './users'
import { wholesaleAccountRequests } from './wholesaleRequests'

export const customerPortalInvites = pgTable('customer_portal_invites', {
  id: uuid('id').primaryKey().defaultRandom(),
  requestId: uuid('request_id').notNull().references(() => wholesaleAccountRequests.id, { onDelete: 'cascade' }),
  accountId: uuid('account_id').notNull().references(() => customerAccounts.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  tokenHash: text('token_hash').notNull().unique(),
  status: text('status', { enum: ['pending', 'accepted', 'revoked', 'expired'] }).notNull().default('pending'),
  invitedByUserId: uuid('invited_by_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  acceptedUserId: uuid('accepted_user_id').references(() => users.id, { onDelete: 'set null' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  emailIdx: index('customer_portal_invites_email_idx').on(table.email),
  accountIdx: index('customer_portal_invites_account_idx').on(table.accountId),
  statusIdx: index('customer_portal_invites_status_idx').on(table.status),
}))

export type CustomerPortalInvite = typeof customerPortalInvites.$inferSelect
export type NewCustomerPortalInvite = typeof customerPortalInvites.$inferInsert
