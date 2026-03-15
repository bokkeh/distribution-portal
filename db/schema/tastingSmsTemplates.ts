import { integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

export const tastingSmsTemplates = pgTable('tasting_sms_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  key: text('key').notNull().unique(),
  label: text('label').notNull(),
  description: text('description').notNull(),
  bodyTemplate: text('body_template').notNull(),
  linkPath: text('link_path'),
  sortOrder: integer('sort_order').notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export type TastingSmsTemplate = typeof tastingSmsTemplates.$inferSelect
