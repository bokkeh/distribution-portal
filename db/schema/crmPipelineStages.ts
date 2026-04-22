import { integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

export const crmPipelineStages = pgTable('crm_pipeline_stages', {
  id: uuid('id').primaryKey().defaultRandom(),
  stageKey: text('stage_key').notNull().unique(),
  label: text('label').notNull(),
  colorToken: text('color_token').notNull().default('slate'),
  position: integer('position').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type CRMPipelineStage = typeof crmPipelineStages.$inferSelect
export type NewCRMPipelineStage = typeof crmPipelineStages.$inferInsert
