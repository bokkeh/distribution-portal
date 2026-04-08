import { doublePrecision, index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'

export const geocodeCache = pgTable('geocode_cache', {
  id: uuid('id').primaryKey().defaultRandom(),
  normalizedAddress: text('normalized_address').notNull(),
  originalAddress: text('original_address').notNull(),
  lat: doublePrecision('lat'),
  lng: doublePrecision('lng'),
  status: text('status').notNull().default('ok'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  normalizedAddressUniqueIdx: uniqueIndex('geocode_cache_normalized_address_idx').on(table.normalizedAddress),
  statusUpdatedIdx: index('geocode_cache_status_updated_idx').on(table.status, table.updatedAt),
}))

export type GeocodeCache = typeof geocodeCache.$inferSelect
export type NewGeocodeCache = typeof geocodeCache.$inferInsert
