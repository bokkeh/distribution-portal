import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { tastings } from './tastings'
import { users } from './users'

export const tastingReportPhotoDrafts = pgTable('tasting_report_photo_drafts', {
  tastingId: uuid('tasting_id').primaryKey().references(() => tastings.id, { onDelete: 'cascade' }),
  savedByUserId: uuid('saved_by_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  setupPhotoUrl: text('setup_photo_url'),
  shelfPhotoUrls: jsonb('shelf_photo_urls').$type<string[]>().notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export type TastingReportPhotoDraft = typeof tastingReportPhotoDrafts.$inferSelect
export type NewTastingReportPhotoDraft = typeof tastingReportPhotoDrafts.$inferInsert
