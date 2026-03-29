import { pgTable, uuid, text, integer, numeric, date, timestamp, boolean, jsonb, index } from 'drizzle-orm/pg-core'
import { drivers } from './drivers'
import { orders } from './orders'
import { customerAccounts } from './customers'
import { users } from './users'

export const deliveries = pgTable('deliveries', {
  id: uuid('id').primaryKey().defaultRandom(),
  weekStartDate: date('week_start_date').notNull(),
  driverId: uuid('driver_id').notNull().references(() => drivers.id),
  status: text('status', { enum: ['scheduled', 'in_progress', 'completed', 'cancelled'] }).notNull().default('scheduled'),
  originAddress: text('origin_address'),
  originLat: numeric('origin_lat', { precision: 10, scale: 7 }),
  originLng: numeric('origin_lng', { precision: 10, scale: 7 }),
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
  additionalPhotoUrl: text('additional_photo_url'),
  additionalPhotoUrl2: text('additional_photo_url_2'),
  additionalPhotoUrl3: text('additional_photo_url_3'),
  additionalPhotoUrl4: text('additional_photo_url_4'),
  additionalPhotoUrl5: text('additional_photo_url_5'),
  trackingEnabled: boolean('tracking_enabled').notNull().default(false),
  trackingToken: text('tracking_token').unique(),
  trackingTokenCreatedAt: timestamp('tracking_token_created_at', { withTimezone: true }),
  trackingExpiresAt: timestamp('tracking_expires_at', { withTimezone: true }),
  customerStatus: text('customer_status', { enum: ['not_started', 'out_for_delivery', 'arriving_soon', 'arrived', 'delivered', 'failed'] }).notNull().default('not_started'),
  outForDeliveryAt: timestamp('out_for_delivery_at', { withTimezone: true }),
  arrivingSoonAt: timestamp('arriving_soon_at', { withTimezone: true }),
  arrivedAt: timestamp('arrived_at', { withTimezone: true }),
  deliveredAt: timestamp('delivered_at', { withTimezone: true }),
  etaMinutes: integer('eta_minutes'),
  distanceMiles: numeric('distance_miles', { precision: 8, scale: 2 }),
  lastKnownDriverLat: numeric('last_known_driver_lat', { precision: 10, scale: 7 }),
  lastKnownDriverLng: numeric('last_known_driver_lng', { precision: 10, scale: 7 }),
  lastLocationAt: timestamp('last_location_at', { withTimezone: true }),
  recipientSignatureUrl: text('recipient_signature_url'),
  recipientSignedName: text('recipient_signed_name'),
  recipientSignedAt: timestamp('recipient_signed_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
})

export const deliveryNotifications = pgTable('delivery_notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  deliveryId: uuid('delivery_id').notNull().references(() => deliveries.id, { onDelete: 'cascade' }),
  stopId: uuid('stop_id').notNull().references(() => deliveryStops.id, { onDelete: 'cascade' }),
  customerId: uuid('customer_id').references(() => customerAccounts.id, { onDelete: 'set null' }),
  notificationType: text('notification_type', { enum: ['out_for_delivery', 'arriving_soon', 'arrived', 'delivered'] }).notNull(),
  channel: text('channel', { enum: ['sms', 'mms'] }).notNull(),
  messageBody: text('message_body').notNull(),
  mediaUrl: text('media_url'),
  provider: text('provider').notNull().default('telnyx'),
  providerMessageId: text('provider_message_id'),
  status: text('status', { enum: ['pending', 'sent', 'delivered', 'failed'] }).notNull().default('pending'),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  deliveredAt: timestamp('delivered_at', { withTimezone: true }),
  failedAt: timestamp('failed_at', { withTimezone: true }),
  failureReason: text('failure_reason'),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  stopTypeIdx: index('delivery_notifications_stop_type_idx').on(table.stopId, table.notificationType),
}))

export const deliveryLocationUpdates = pgTable('delivery_location_updates', {
  id: uuid('id').primaryKey().defaultRandom(),
  deliveryId: uuid('delivery_id').notNull().references(() => deliveries.id, { onDelete: 'cascade' }),
  stopId: uuid('stop_id').references(() => deliveryStops.id, { onDelete: 'cascade' }),
  driverId: uuid('driver_id').notNull().references(() => drivers.id, { onDelete: 'cascade' }),
  lat: numeric('lat', { precision: 10, scale: 7 }).notNull(),
  lng: numeric('lng', { precision: 10, scale: 7 }).notNull(),
  source: text('source', { enum: ['driver_browser', 'dispatcher', 'system'] }).notNull().default('driver_browser'),
  recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  deliveryRecordedIdx: index('delivery_location_updates_delivery_recorded_idx').on(table.deliveryId, table.recordedAt),
}))

export const deliveryTrackingEvents = pgTable('delivery_tracking_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  deliveryId: uuid('delivery_id').notNull().references(() => deliveries.id, { onDelete: 'cascade' }),
  stopId: uuid('stop_id').references(() => deliveryStops.id, { onDelete: 'cascade' }),
  eventType: text('event_type').notNull(),
  eventData: jsonb('event_data').notNull().default({}),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  deliveryEventIdx: index('delivery_tracking_events_delivery_event_idx').on(table.deliveryId, table.createdAt),
}))

export type Delivery = typeof deliveries.$inferSelect
export type NewDelivery = typeof deliveries.$inferInsert
export type DeliveryStop = typeof deliveryStops.$inferSelect
export type NewDeliveryStop = typeof deliveryStops.$inferInsert
export type DeliveryNotification = typeof deliveryNotifications.$inferSelect
export type NewDeliveryNotification = typeof deliveryNotifications.$inferInsert
export type DeliveryLocationUpdate = typeof deliveryLocationUpdates.$inferSelect
export type NewDeliveryLocationUpdate = typeof deliveryLocationUpdates.$inferInsert
export type DeliveryTrackingEvent = typeof deliveryTrackingEvents.$inferSelect
export type NewDeliveryTrackingEvent = typeof deliveryTrackingEvents.$inferInsert
