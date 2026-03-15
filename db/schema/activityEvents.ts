import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { users } from './users'

export const activityEvents = pgTable('activity_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityType: text('entity_type').notNull(),
  entityId: uuid('entity_id').notNull(),
  actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
  relatedUserId: uuid('related_user_id').references(() => users.id, { onDelete: 'set null' }),
  kind: text('kind').notNull(),
  title: text('title').notNull(),
  body: text('body'),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type ActivityEvent = typeof activityEvents.$inferSelect
export type NewActivityEvent = typeof activityEvents.$inferInsert
