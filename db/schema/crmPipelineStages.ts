import { integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

export const CRM_PIPELINE_ENTITY_TYPES = ['account', 'contact', 'community_contact', 'hubspot_company'] as const
export type CrmPipelineEntityType = (typeof CRM_PIPELINE_ENTITY_TYPES)[number]

export const crmPipelineStages = pgTable('crm_pipeline_stages', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityType: text('entity_type', { enum: CRM_PIPELINE_ENTITY_TYPES }).notNull().default('account'),
  stageKey: text('stage_key').notNull(),
  label: text('label').notNull(),
  colorToken: text('color_token').notNull().default('slate'),
  position: integer('position').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type CRMPipelineStage = typeof crmPipelineStages.$inferSelect
export type NewCRMPipelineStage = typeof crmPipelineStages.$inferInsert
