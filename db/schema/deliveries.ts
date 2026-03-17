import { pgTable, uuid, text, integer, numeric, date, timestamp } from 'drizzle-orm/pg-core'
import { drivers } from './drivers'
import { orders } from './orders'
import { customerAccounts } from './customers'

export const deliveries = pgTable('deliveries', {
  id: uuid('id').primaryKey().defaultRandom(),
  weekStartDate: date('week_start_date').notNull(),
  driverId: uuid('driver_id').notNull().references(() => drivers.id),
  status: text('status', { enum: ['scheduled', 'in_progress', 'completed', 'cancelled'] }).notNull().default('scheduled'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const deliveryStops = pgTable('delivery_stops', {
  id: uuid('id').primaryKey().defaultRandom(),
  deliveryId: uuid('delivery_id').notNull().references(() => deliveries.id, { onDelete: 'cascade' }),
  orderId: uuid('order_id').references(() => orders.id),
  customerId: uuid('customer_id').references(() => customerAccounts.id),
  sequenceNumber: integer('sequence_number').notNull(),
  address: text('address').notNull(),
  contactName: text('contact_name'),
  contactPhone: text('contact_phone'),
  contactEmail: text('contact_email'),
  lat: numeric('lat', { precision: 10, scale: 7 }),
  lng: numeric('lng', { precision: 10, scale: 7 }),
  status: text('status', { enum: ['pending', 'delivered', 'failed'] }).notNull().default('pending'),
  notes: text('notes'),
  proofOfDeliveryUrl: text('proof_of_delivery_url'),
  shelfPhotoUrl: text('shelf_photo_url'),
  completedAt: timestamp('completed_at', { withTimezone: true }),
})

export type Delivery = typeof deliveries.$inferSelect
export type NewDelivery = typeof deliveries.$inferInsert
export type DeliveryStop = typeof deliveryStops.$inferSelect
export type NewDeliveryStop = typeof deliveryStops.$inferInsert
