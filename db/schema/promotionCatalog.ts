import { sql } from 'drizzle-orm'
import { boolean, integer, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { customerAccounts } from './customers'
import { salesMembers } from './salesMembers'
import { users } from './users'

export const promotionCatalogItems = pgTable('promotion_catalog_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  description: text('description'),
  category: text('category', {
    enum: ['social_post', 'in_store_signage', 'menu_feature', 'bar_sign', 'restaurant_signage', 'window_cling', 'shelf_talker', 'barker_card', 'other'],
  }).notNull(),
  imageUrl: text('image_url').notNull(),
  additionalImageUrls: text('additional_image_urls').array().notNull().default(sql`ARRAY[]::text[]`),
  price: numeric('price', { precision: 12, scale: 2 }).notNull().default('0'),
  sku: text('sku'),
  isActive: boolean('is_active').notNull().default(true),
  isCustomizable: boolean('is_customizable').notNull().default(false),
  leadTimeDays: integer('lead_time_days'),
  fulfillmentType: text('fulfillment_type', { enum: ['digital', 'printed', 'both'] }).notNull().default('printed'),
  notes: text('notes'),
  createdByUserId: uuid('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  updatedByUserId: uuid('updated_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const promotionCatalogAccountAvailability = pgTable('promotion_catalog_account_availability', {
  id: uuid('id').primaryKey().defaultRandom(),
  catalogItemId: uuid('catalog_item_id').notNull().references(() => promotionCatalogItems.id, { onDelete: 'cascade' }),
  accountId: uuid('account_id').notNull().references(() => customerAccounts.id, { onDelete: 'cascade' }),
  assignedByUserId: uuid('assigned_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  visibleToCustomer: boolean('visible_to_customer').notNull().default(true),
  repRecommended: boolean('rep_recommended').notNull().default(false),
  publishedAt: timestamp('published_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const promotionCatalogOrders = pgTable('promotion_catalog_orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: uuid('account_id').notNull().references(() => customerAccounts.id, { onDelete: 'cascade' }),
  catalogItemId: uuid('catalog_item_id').notNull().references(() => promotionCatalogItems.id, { onDelete: 'cascade' }),
  requestedByUserId: uuid('requested_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  assignedSalesMemberId: uuid('assigned_sales_member_id').references(() => salesMembers.id, { onDelete: 'set null' }),
  assignedSalesRepUserId: uuid('assigned_sales_rep_user_id').references(() => users.id, { onDelete: 'set null' }),
  quantity: integer('quantity').notNull().default(1),
  unitPrice: numeric('unit_price', { precision: 12, scale: 2 }).notNull().default('0'),
  totalPrice: numeric('total_price', { precision: 12, scale: 2 }).notNull().default('0'),
  status: text('status', {
    enum: ['requested', 'approved', 'in_production', 'ready_for_delivery', 'delivered', 'completed', 'cancelled'],
  }).notNull().default('requested'),
  customerNotes: text('customer_notes'),
  internalNotes: text('internal_notes'),
  requestedAt: timestamp('requested_at', { withTimezone: true }).notNull().defaultNow(),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  inProductionAt: timestamp('in_production_at', { withTimezone: true }),
  readyAt: timestamp('ready_at', { withTimezone: true }),
  deliveredAt: timestamp('delivered_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  deliveredByUserId: uuid('delivered_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const promotionCatalogOrderEvents = pgTable('promotion_catalog_order_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').notNull().references(() => promotionCatalogOrders.id, { onDelete: 'cascade' }),
  actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
  kind: text('kind').notNull(),
  title: text('title').notNull(),
  body: text('body'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type PromotionCatalogItem = typeof promotionCatalogItems.$inferSelect
export type PromotionCatalogAccountAvailability = typeof promotionCatalogAccountAvailability.$inferSelect
export type PromotionCatalogOrder = typeof promotionCatalogOrders.$inferSelect
export type PromotionCatalogOrderEvent = typeof promotionCatalogOrderEvents.$inferSelect
