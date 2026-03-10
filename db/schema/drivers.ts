import { pgTable, uuid, text, boolean } from 'drizzle-orm/pg-core'
import { users } from './users'

export const drivers = pgTable('drivers', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  vehicleMake: text('vehicle_make'),
  vehicleModel: text('vehicle_model'),
  licensePlate: text('license_plate'),
  phone: text('phone').notNull(),
  active: boolean('active').notNull().default(true),
})

export type Driver = typeof drivers.$inferSelect
export type NewDriver = typeof drivers.$inferInsert
