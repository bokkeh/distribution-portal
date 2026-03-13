import { pgTable, uuid, text, boolean, numeric } from 'drizzle-orm/pg-core'
import { users } from './users'

export const drivers = pgTable('drivers', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  vehicleMake: text('vehicle_make'),
  vehicleModel: text('vehicle_model'),
  vehicleYear: text('vehicle_year'),
  vin: text('vin'),
  licensePlate: text('license_plate'),
  vehicleImageUrl: text('vehicle_image_url'),
  homeAddress: text('home_address'),
  homeCity: text('home_city'),
  homeState: text('home_state'),
  homeZip: text('home_zip'),
  homeLat: numeric('home_lat', { precision: 10, scale: 7 }),
  homeLng: numeric('home_lng', { precision: 10, scale: 7 }),
  phone: text('phone').notNull(),
  active: boolean('active').notNull().default(true),
})

export type Driver = typeof drivers.$inferSelect
export type NewDriver = typeof drivers.$inferInsert
