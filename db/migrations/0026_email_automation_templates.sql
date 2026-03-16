CREATE TABLE IF NOT EXISTS "email_automation_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "key" text NOT NULL,
  "label" text NOT NULL,
  "description" text NOT NULL,
  "audience" text NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "subject_template" text NOT NULL,
  "eyebrow" text NOT NULL,
  "title_template" text NOT NULL,
  "intro_template" text,
  "body_template" text NOT NULL,
  "cta_label" text,
  "cta_path" text,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "email_automation_templates_key_unique" UNIQUE("key")
);

CREATE INDEX IF NOT EXISTS "email_automation_templates_sort_idx"
ON "email_automation_templates" ("sort_order");
