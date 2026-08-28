ALTER TABLE "crm_pipeline_stages" ADD COLUMN IF NOT EXISTS "entity_type" text NOT NULL DEFAULT 'account';
ALTER TABLE "crm_pipeline_stages" DROP CONSTRAINT IF EXISTS "crm_pipeline_stages_stage_key_unique";
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'crm_pipeline_stages_entity_stage_key_unique'
  ) THEN
    ALTER TABLE "crm_pipeline_stages" ADD CONSTRAINT "crm_pipeline_stages_entity_stage_key_unique" UNIQUE ("entity_type", "stage_key");
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS "crm_pipeline_stages_entity_position_idx" ON "crm_pipeline_stages" ("entity_type", "position");

ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "deal_stage" text;
ALTER TABLE "community_contacts" ADD COLUMN IF NOT EXISTS "deal_stage" text;

CREATE TABLE IF NOT EXISTS "hubspot_company_pipeline_stages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "hubspot_company_id" text NOT NULL UNIQUE,
  "stage_key" text NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
