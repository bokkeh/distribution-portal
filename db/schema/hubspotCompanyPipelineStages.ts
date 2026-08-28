import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

export const hubspotCompanyPipelineStages = pgTable('hubspot_company_pipeline_stages', {
  id: uuid('id').primaryKey().defaultRandom(),
  hubspotCompanyId: text('hubspot_company_id').notNull().unique(),
  stageKey: text('stage_key').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export type HubspotCompanyPipelineStage = typeof hubspotCompanyPipelineStages.$inferSelect
export type NewHubspotCompanyPipelineStage = typeof hubspotCompanyPipelineStages.$inferInsert
