import { pgTable, uuid, text, numeric, integer, boolean, timestamp } from 'drizzle-orm/pg-core'

export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  sku: text('sku').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  category: text('category'),
  brand: text('brand'),
  price: numeric('price', { precision: 10, scale: 2 }).notNull(),
  samplePrice: numeric('sample_price', { precision: 10, scale: 2 }).notNull().default('0'),
  imageUrl: text('image_url'),
  unit: text('unit').notNull().default('case'),
  casesPerPallet: integer('cases_per_pallet'),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type Product = typeof products.$inferSelect
export type NewProduct = typeof products.$inferInsert
