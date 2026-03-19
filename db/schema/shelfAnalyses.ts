import { pgTable, uuid, text, integer, boolean, jsonb, timestamp } from 'drizzle-orm/pg-core'
import { deliveries, deliveryStops } from './deliveries'
import { customerAccounts } from './customers'

export const shelfAnalyses = pgTable('shelf_analyses', {
  id: uuid('id').primaryKey().defaultRandom(),
  deliveryId: uuid('delivery_id').notNull().references(() => deliveries.id, { onDelete: 'cascade' }),
  deliveryStopId: uuid('delivery_stop_id').notNull().references(() => deliveryStops.id, { onDelete: 'cascade' }),
  customerId: uuid('customer_id').references(() => customerAccounts.id),
  imageUrls: jsonb('image_urls').$type<string[]>().notNull().default([]),
  // status: pending | complete | partial | error
  status: text('status').notNull().default('pending'),
  // confidence: high | medium | low
  confidence: text('confidence'),
  summary: text('summary'),
  wisherDetected: boolean('wisher_detected'),
  // shelfLevel: top | eye | mid | bottom | unknown
  shelfLevel: text('shelf_level'),
  // horizontalPosition: left | center | right | unknown
  horizontalPosition: text('horizontal_position'),
  facings: integer('facings'),
  labelForward: boolean('label_forward'),
  obstructionDetected: boolean('obstruction_detected'),
  detectedPrice: text('detected_price'),
  promoDetected: boolean('promo_detected'),
  // stockLevel: full | medium | low | nearly_empty | unknown
  stockLevel: text('stock_level'),
  competitors: jsonb('competitors').$type<string[]>(),
  placementScore: integer('placement_score'),
  visibilityScore: integer('visibility_score'),
  facingScore: integer('facing_score'),
  overallScore: integer('overall_score'),
  insights: jsonb('insights').$type<Record<string, string>>(),
  recommendations: jsonb('recommendations').$type<string[]>(),
  // trend: improving | stable | declining | no_prior_data
  trend: text('trend'),
  trendNotes: text('trend_notes'),
  errorMessage: text('error_message'),
  userOverrides: jsonb('user_overrides').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type ShelfAnalysis = typeof shelfAnalyses.$inferSelect
export type NewShelfAnalysis = typeof shelfAnalyses.$inferInsert
