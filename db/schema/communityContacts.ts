import { index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { tastings } from './tastings'
import { users } from './users'

export const communityContacts = pgTable('community_contacts', {
  id: uuid('id').primaryKey().defaultRandom(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  email: text('email').notNull(),
  phone: text('phone').notNull(),
  addressLine1: text('address_line_1'),
  addressLine2: text('address_line_2'),
  city: text('city'),
  state: text('state'),
  postalCode: text('postal_code'),
  country: text('country').notNull().default('US'),
  status: text('status', { enum: ['subscribed', 'unsubscribed'] }).notNull().default('subscribed'),
  source: text('source', { enum: ['public_signup', 'admin_entry', 'import'] }).notNull(),
  dealStage: text('deal_stage'),
  marketingConsentAt: timestamp('marketing_consent_at', { withTimezone: true }).notNull().defaultNow(),
  createdByUserId: uuid('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('community_contacts_email_uidx').on(table.email),
  index('community_contacts_status_idx').on(table.status),
  index('community_contacts_created_at_idx').on(table.createdAt),
])

export const communityContactNotes = pgTable('community_contact_notes', {
  id: uuid('id').primaryKey().defaultRandom(),
  communityContactId: uuid('community_contact_id').notNull().references(() => communityContacts.id, { onDelete: 'cascade' }),
  body: text('body').notNull(),
  authorUserId: uuid('author_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('community_contact_notes_contact_created_idx').on(table.communityContactId, table.createdAt),
])

export const communityEventAttendance = pgTable('community_event_attendance', {
  id: uuid('id').primaryKey().defaultRandom(),
  communityContactId: uuid('community_contact_id').notNull().references(() => communityContacts.id, { onDelete: 'cascade' }),
  tastingId: uuid('tasting_id').notNull().references(() => tastings.id, { onDelete: 'cascade' }),
  attendedAt: timestamp('attended_at', { withTimezone: true }).notNull(),
  notes: text('notes'),
  createdByUserId: uuid('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('community_event_attendance_contact_tasting_uidx').on(table.communityContactId, table.tastingId),
  index('community_event_attendance_contact_idx').on(table.communityContactId, table.attendedAt),
  index('community_event_attendance_tasting_idx').on(table.tastingId),
])

export const communityContactCommunications = pgTable('community_contact_communications', {
  id: uuid('id').primaryKey().defaultRandom(),
  communityContactId: uuid('community_contact_id').notNull().references(() => communityContacts.id, { onDelete: 'cascade' }),
  channel: text('channel', { enum: ['email'] }).notNull(),
  direction: text('direction', { enum: ['outbound'] }).notNull().default('outbound'),
  subject: text('subject'),
  body: text('body').notNull(),
  status: text('status', { enum: ['sent', 'failed'] }).notNull(),
  actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('community_contact_communications_contact_idx').on(table.communityContactId, table.occurredAt),
])

export type CommunityContact = typeof communityContacts.$inferSelect
export type NewCommunityContact = typeof communityContacts.$inferInsert
export type CommunityContactNote = typeof communityContactNotes.$inferSelect
export type CommunityEventAttendance = typeof communityEventAttendance.$inferSelect
export type CommunityContactCommunication = typeof communityContactCommunications.$inferSelect
