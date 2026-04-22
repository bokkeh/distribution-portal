ALTER TABLE "customer_accounts"
ADD COLUMN "first_name" text,
ADD COLUMN "last_name" text;

CREATE TABLE "crm_pipeline_stages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "stage_key" text NOT NULL,
  "label" text NOT NULL,
  "color_token" text DEFAULT 'slate' NOT NULL,
  "position" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "crm_pipeline_stages_stage_key_unique" UNIQUE("stage_key")
);

INSERT INTO "crm_pipeline_stages" ("stage_key", "label", "color_token", "position")
VALUES
  ('new_lead', 'New Lead', 'slate', 0),
  ('contacted', 'Contacted', 'blue', 1),
  ('warm', 'Warm', 'amber', 2),
  ('qualified', 'Qualified', 'violet', 3),
  ('active', 'Active Customer', 'green', 4),
  ('lost', 'Lost', 'red', 5);
