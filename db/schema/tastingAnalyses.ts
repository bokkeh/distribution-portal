import { integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { tastings } from './tastings'

export const tastingAnalyses = pgTable('tasting_analyses', {
  id: uuid('id').primaryKey().defaultRandom(),
  tastingId: uuid('tasting_id').notNull().references(() => tastings.id, { onDelete: 'cascade' }),
  imageUrls: jsonb('image_urls').$type<string[]>().notNull().default([]),
  // status: pending | complete | error
  status: text('status').notNull().default('pending'),
  summary: text('summary'),
  setupScore: integer('setup_score'),
  shelfScore: integer('shelf_score'),
  overallScore: integer('overall_score'),
  // conversionRating: high | medium | low | none
  conversionRating: text('conversion_rating'),
  insights: jsonb('insights').$type<Record<string, string>>(),
  recommendations: jsonb('recommendations').$type<string[]>(),
  // trend: improving | stable | declining | no_prior_data
  trend: text('trend'),
  trendNotes: text('trend_notes'),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type TastingAnalysis = typeof tastingAnalyses.$inferSelect
export type NewTastingAnalysis = typeof tastingAnalyses.$inferInsert
