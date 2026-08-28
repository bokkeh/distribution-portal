import { boolean, integer, jsonb, numeric, pgTable, text, timestamp, uuid, index } from 'drizzle-orm/pg-core'
import { customerAccounts } from './customers'
import { products } from './products'
import { users } from './users'

export const tastings = pgTable('tastings', {
  id: uuid('id').primaryKey().defaultRandom(),
  customerId: uuid('customer_id').notNull().references(() => customerAccounts.id, { onDelete: 'cascade' }),
  assignedUserId: uuid('assigned_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdByUserId: uuid('created_by_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  eventName: text('event_name').notNull(),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
  endAt: timestamp('end_at', { withTimezone: true }),
  checkedInAt: timestamp('checked_in_at', { withTimezone: true }),
  status: text('status', { enum: ['requested', 'scheduled', 'confirmed', 'completed', 'cancelled', 'declined'] }).notNull().default('scheduled'),
  storeAddress: text('store_address'),
  storeCity: text('store_city'),
  storeState: text('store_state'),
  storeZip: text('store_zip'),
  storePhone: text('store_phone'),
  trainingDay: boolean('training_day').notNull().default(false),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const tastingProducts = pgTable('tasting_products', {
  id: uuid('id').primaryKey().defaultRandom(),
  tastingId: uuid('tasting_id').notNull().references(() => tastings.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').notNull().references(() => products.id),
  plannedQuantity: numeric('planned_quantity', { precision: 10, scale: 2 }).notNull().default('0'),
  startingInventory: jsonb('starting_inventory').$type<{ cases?: number; bottles?: number; units?: number }>().notNull().default({}),
  unitsSold: integer('units_sold').notNull().default(0),
  revenueGenerated: numeric('revenue_generated', { precision: 12, scale: 2 }).notNull().default('0'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('tasting_products_tasting_idx').on(table.tastingId),
  index('tasting_products_product_idx').on(table.productId),
])

export type Tasting = typeof tastings.$inferSelect
export type NewTasting = typeof tastings.$inferInsert
export type TastingProduct = typeof tastingProducts.$inferSelect
export type NewTastingProduct = typeof tastingProducts.$inferInsert
