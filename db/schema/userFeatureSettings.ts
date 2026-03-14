import { sql } from 'drizzle-orm'
import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { users } from './users'

export const userFeatureSettings = pgTable('user_feature_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  features: text('features').array().notNull().default(sql`ARRAY[]::text[]`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export type UserFeatureSetting = typeof userFeatureSettings.$inferSelect
export type NewUserFeatureSetting = typeof userFeatureSettings.$inferInsert
