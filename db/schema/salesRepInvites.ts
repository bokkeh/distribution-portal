import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { users } from './users'

export const salesRepInvites = pgTable('sales_rep_invites', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull(),
  name: text('name'),
  phone: text('phone'),
  tokenHash: text('token_hash').notNull().unique(),
  status: text('status', { enum: ['pending', 'accepted', 'revoked', 'expired'] }).notNull().default('pending'),
  invitedByUserId: uuid('invited_by_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  acceptedUserId: uuid('accepted_user_id').references(() => users.id, { onDelete: 'set null' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  emailIdx: index('sales_rep_invites_email_idx').on(table.email),
  statusIdx: index('sales_rep_invites_status_idx').on(table.status),
}))

export type SalesRepInvite = typeof salesRepInvites.$inferSelect
export type NewSalesRepInvite = typeof salesRepInvites.$inferInsert
