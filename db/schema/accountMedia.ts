import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { customerAccounts } from './customers'
import { users } from './users'

export const accountMedia = pgTable('account_media', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: uuid('account_id').notNull().references(() => customerAccounts.id, { onDelete: 'cascade' }),
  mediaUrl: text('media_url').notNull(),
  mediaType: text('media_type').notNull().default('image'),
  category: text('category').notNull().default('store_visit'),
  taggedDate: timestamp('tagged_date', { withTimezone: true }).notNull(),
  caption: text('caption'),
  uploadedByUserId: uuid('uploaded_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  accountTaggedDateIdx: index('account_media_account_tagged_date_idx').on(table.accountId, table.taggedDate),
  accountCreatedIdx: index('account_media_account_created_idx').on(table.accountId, table.createdAt),
}))

export type AccountMedia = typeof accountMedia.$inferSelect
export type NewAccountMedia = typeof accountMedia.$inferInsert
