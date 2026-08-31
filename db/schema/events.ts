import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { communityContacts } from './communityContacts'
import { customerAccounts } from './customers'
import { users } from './users'

export const events = pgTable('events', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  eventType: text('event_type', {
    enum: ['party', 'pop_up', 'festival', 'community_event', 'retail_activation', 'partner_event', 'dinner', 'sponsorship', 'sports_event', 'trade_event', 'other'],
  }).notNull().default('community_event'),
  startAt: timestamp('start_at', { withTimezone: true }).notNull(),
  endAt: timestamp('end_at', { withTimezone: true }).notNull(),
  timeZone: text('time_zone').notNull().default('America/New_York'),
  status: text('status', { enum: ['draft', 'scheduled', 'cancelled', 'completed'] }).notNull().default('draft'),
  visibility: text('visibility', { enum: ['draft', 'public', 'link_only', 'closed'] }).notNull().default('draft'),
  organizerUserId: uuid('organizer_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdByUserId: uuid('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  accountId: uuid('account_id').references(() => customerAccounts.id, { onDelete: 'set null' }),
  locationMode: text('location_mode', { enum: ['manual', 'account'] }).notNull().default('manual'),
  venueName: text('venue_name'),
  addressLine1: text('address_line_1'),
  addressLine2: text('address_line_2'),
  city: text('city'),
  state: text('state'),
  postalCode: text('postal_code'),
  country: text('country').notNull().default('US'),
  venueContactName: text('venue_contact_name'),
  venuePhone: text('venue_phone'),
  venueWebsite: text('venue_website'),
  sourceChannel: text('source_channel'),
  rsvpOptionalFields: jsonb('rsvp_optional_fields').$type<string[]>().notNull().default([]),
  attendeeUploadPolicy: text('attendee_upload_policy', { enum: ['disabled', 'immediate', 'approval', 'private'] }).notNull().default('approval'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('events_slug_uidx').on(table.slug),
  index('events_start_at_idx').on(table.startAt),
  index('events_status_idx').on(table.status),
  index('events_account_idx').on(table.accountId),
  index('events_organizer_idx').on(table.organizerUserId),
])

export const eventParticipants = pgTable('event_participants', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  communityContactId: uuid('community_contact_id').notNull().references(() => communityContacts.id, { onDelete: 'cascade' }),
  rsvpStatus: text('rsvp_status', { enum: ['confirmed', 'maybe', 'declined'] }).notNull().default('confirmed'),
  attendanceStatus: text('attendance_status', { enum: ['not_checked_in', 'checked_in', 'no_show'] }).notNull().default('not_checked_in'),
  source: text('source', { enum: ['public_rsvp', 'manual', 'import'] }).notNull().default('manual'),
  guestCount: integer('guest_count').notNull().default(0),
  guestNames: jsonb('guest_names').$type<string[]>().notNull().default([]),
  company: text('company'),
  instagramHandle: text('instagram_handle'),
  notes: text('notes'),
  marketingConsent: boolean('marketing_consent').notNull().default(false),
  smsConsent: boolean('sms_consent').notNull().default(false),
  managementToken: uuid('management_token').notNull().defaultRandom(),
  checkedInAt: timestamp('checked_in_at', { withTimezone: true }),
  createdByUserId: uuid('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('event_participants_event_contact_uidx').on(table.eventId, table.communityContactId),
  uniqueIndex('event_participants_management_token_uidx').on(table.managementToken),
  index('event_participants_event_idx').on(table.eventId),
  index('event_participants_contact_idx').on(table.communityContactId),
  index('event_participants_rsvp_idx').on(table.eventId, table.rsvpStatus),
  index('event_participants_attendance_idx').on(table.eventId, table.attendanceStatus),
])

export const eventMedia = pgTable('event_media', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  storagePath: text('storage_path').notNull(),
  fileName: text('file_name').notNull(),
  contentType: text('content_type').notNull(),
  mediaType: text('media_type', { enum: ['image', 'video', 'pdf', 'document'] }).notNull(),
  placement: text('placement', { enum: ['hero', 'gallery', 'promotional', 'attachment', 'internal'] }).notNull().default('gallery'),
  uploadSource: text('upload_source', { enum: ['organizer', 'attendee'] }).notNull().default('organizer'),
  approvalStatus: text('approval_status', { enum: ['pending', 'approved', 'rejected', 'private'] }).notNull().default('approved'),
  uploadedByUserId: uuid('uploaded_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  uploadedByContactId: uuid('uploaded_by_contact_id').references(() => communityContacts.id, { onDelete: 'set null' }),
  uploaderName: text('uploader_name'),
  uploaderEmail: text('uploader_email'),
  caption: text('caption'),
  featured: boolean('featured').notNull().default(false),
  reviewedByUserId: uuid('reviewed_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('event_media_event_created_idx').on(table.eventId, table.createdAt),
  index('event_media_event_approval_idx').on(table.eventId, table.approvalStatus),
])

export const eventCommunications = pgTable('event_communications', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  channel: text('channel', { enum: ['email', 'sms'] }).notNull(),
  audience: text('audience').notNull(),
  messageType: text('message_type').notNull(),
  subject: text('subject'),
  body: text('body').notNull(),
  status: text('status', { enum: ['sent', 'partial', 'failed'] }).notNull(),
  recipientCount: integer('recipient_count').notNull().default(0),
  sentCount: integer('sent_count').notNull().default(0),
  failedCount: integer('failed_count').notNull().default(0),
  actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
  sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('event_communications_event_sent_idx').on(table.eventId, table.sentAt),
])

export const eventReminders = pgTable('event_reminders', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  reminderType: text('reminder_type', { enum: ['seven_days', 'twenty_four_hours', 'two_hours', 'thank_you'] }).notNull(),
  offsetMinutes: integer('offset_minutes').notNull(),
  channels: jsonb('channels').$type<Array<'email' | 'sms'>>().notNull().default(['email']),
  enabled: boolean('enabled').notNull().default(false),
  lastSentAt: timestamp('last_sent_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('event_reminders_event_type_uidx').on(table.eventId, table.reminderType),
  index('event_reminders_enabled_idx').on(table.enabled),
])

export type EventRecord = typeof events.$inferSelect
export type EventParticipant = typeof eventParticipants.$inferSelect
export type EventMedia = typeof eventMedia.$inferSelect
export type EventCommunication = typeof eventCommunications.$inferSelect
export type EventReminder = typeof eventReminders.$inferSelect
