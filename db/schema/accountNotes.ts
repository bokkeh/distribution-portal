import { boolean, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { customerAccounts } from './customers'
import { users } from './users'

export const accountNotes = pgTable('account_notes', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: uuid('account_id').notNull().references(() => customerAccounts.id, { onDelete: 'cascade' }),
  noteBody: text('note_body').notNull(),
  noteType: text('note_type').notNull().default('general_update'),
  authorUserId: uuid('author_user_id').references(() => users.id, { onDelete: 'set null' }),
  authorRole: text('author_role').notNull().default('system'),
  isPinned: boolean('is_pinned').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  accountCreatedIdx: index('account_notes_account_created_idx').on(table.accountId, table.createdAt),
}))

export type AccountNote = typeof accountNotes.$inferSelect
export type NewAccountNote = typeof accountNotes.$inferInsert
