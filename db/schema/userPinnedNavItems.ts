import { index, integer, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core'
import { users } from './users'

export const userPinnedNavItems = pgTable('user_pinned_nav_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  navKey: text('nav_key').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  pinnedAt: timestamp('pinned_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userNavKeyUnique: unique('user_pinned_nav_items_user_nav_key_unique').on(table.userId, table.navKey),
  userIdIdx: index('user_pinned_nav_items_user_id_idx').on(table.userId),
}))

export type UserPinnedNavItem = typeof userPinnedNavItems.$inferSelect
export type NewUserPinnedNavItem = typeof userPinnedNavItems.$inferInsert
