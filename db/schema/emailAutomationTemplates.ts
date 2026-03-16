import { integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

export const emailAutomationTemplates = pgTable('email_automation_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  key: text('key').notNull().unique(),
  label: text('label').notNull(),
  description: text('description').notNull(),
  audience: text('audience').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  subjectTemplate: text('subject_template').notNull(),
  eyebrow: text('eyebrow').notNull(),
  titleTemplate: text('title_template').notNull(),
  introTemplate: text('intro_template'),
  bodyTemplate: text('body_template').notNull(),
  ctaLabel: text('cta_label'),
  ctaPath: text('cta_path'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type EmailAutomationTemplate = typeof emailAutomationTemplates.$inferSelect
