import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { users } from './users'

export const tasterInvites = pgTable('taster_invites', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  status: text('status', { enum: ['pending', 'accepted', 'revoked', 'expired'] }).notNull().default('pending'),
  createdByUserId: uuid('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index('taster_invites_user_id_idx').on(table.userId),
  statusIdx: index('taster_invites_status_idx').on(table.status),
}))

export type TasterInvite = typeof tasterInvites.$inferSelect
export type NewTasterInvite = typeof tasterInvites.$inferInsert
