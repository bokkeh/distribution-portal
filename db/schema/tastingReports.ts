import { boolean, integer, jsonb, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { tastings } from './tastings'
import { users } from './users'

export const tastingReports = pgTable('tasting_reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  tastingId: uuid('tasting_id').notNull().unique().references(() => tastings.id, { onDelete: 'cascade' }),
  submittedByUserId: uuid('submitted_by_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  actualStartTime: text('actual_start_time'),
  actualEndTime: text('actual_end_time'),
  samplesServed: integer('samples_served'),
  bottlesSold: integer('bottles_sold'),
  casesSold: integer('cases_sold'),
  missedCustomers: integer('missed_customers'),
  consumerInteractions: integer('consumer_interactions'),
  bottlePriceOnShelf: numeric('bottle_price_on_shelf', { precision: 10, scale: 2 }),
  bottlesInStock: integer('bottles_in_stock'),
  accountFeedback: text('account_feedback'),
  highlights: text('highlights'),
  issues: text('issues'),
  followUpNeeded: boolean('follow_up_needed').notNull().default(false),
  followUpNotes: text('follow_up_notes'),
  setupPhotoUrl: text('setup_photo_url'),
  shelfPhotoUrls: jsonb('shelf_photo_urls').$type<string[]>().default([]),
  submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow(),
})

export type TastingReport = typeof tastingReports.$inferSelect
export type NewTastingReport = typeof tastingReports.$inferInsert
