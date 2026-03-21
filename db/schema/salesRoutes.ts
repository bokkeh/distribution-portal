import { pgTable, uuid, text, integer, numeric, timestamp } from 'drizzle-orm/pg-core'
import { customerAccounts } from './customers'
import { users } from './users'
import { salesMembers } from './salesMembers'
import { salesRegions } from './salesRegions'

export const salesRoutes = pgTable('sales_routes', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
  status: text('status', { enum: ['active', 'archived'] }).notNull().default('active'),
  region: text('region'),
  assignedRepUserId: uuid('assigned_rep_user_id').references(() => users.id),
  assignedSalesMemberId: uuid('assigned_sales_member_id').references(() => salesMembers.id, { onDelete: 'set null' }),
  regionId: uuid('region_id').references(() => salesRegions.id, { onDelete: 'set null' }),
  frequency: text('frequency', { enum: ['weekly', 'biweekly', 'monthly'] }).default('monthly'),
  hourlyRate: numeric('hourly_rate', { precision: 10, scale: 2 }),
  originAddress: text('origin_address'),
  originLat: numeric('origin_lat', { precision: 10, scale: 7 }),
  originLng: numeric('origin_lng', { precision: 10, scale: 7 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const salesRouteStops = pgTable('sales_route_stops', {
  id: uuid('id').primaryKey().defaultRandom(),
  routeId: uuid('route_id').notNull().references(() => salesRoutes.id, { onDelete: 'cascade' }),
  customerId: uuid('customer_id').references(() => customerAccounts.id),
  sequenceNumber: integer('sequence_number').notNull(),
  address: text('address').notNull(),
  contactName: text('contact_name'),
  contactPhone: text('contact_phone'),
  lat: numeric('lat', { precision: 10, scale: 7 }),
  lng: numeric('lng', { precision: 10, scale: 7 }),
  notes: text('notes'),
  visitPhotoUrl: text('visit_photo_url'),
  visitedAt: timestamp('visited_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type SalesRoute = typeof salesRoutes.$inferSelect
export type NewSalesRoute = typeof salesRoutes.$inferInsert
export type SalesRouteStop = typeof salesRouteStops.$inferSelect
export type NewSalesRouteStop = typeof salesRouteStops.$inferInsert
