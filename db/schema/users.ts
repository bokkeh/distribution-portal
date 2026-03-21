import { sql } from 'drizzle-orm'
import { pgTable, uuid, text, boolean, timestamp } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role', { enum: ['admin', 'staff', 'driver', 'customer', 'taster', 'sales_rep', 'sales_manager'] }).notNull(),
  roles: text('roles').array().notNull().default(sql`ARRAY['customer']::text[]`),
  name: text('name').notNull(),
  phone: text('phone'),
  address: text('address'),
  city: text('city'),
  state: text('state'),
  zip: text('zip'),
  avatarUrl: text('avatar_url'),
  stripeConnectAccountId: text('stripe_connect_account_id'),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
