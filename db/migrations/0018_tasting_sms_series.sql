ALTER TABLE "tastings" ADD COLUMN IF NOT EXISTS "checked_in_at" timestamp with time zone;

CREATE TABLE IF NOT EXISTS "tasting_sms_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "key" text NOT NULL UNIQUE,
  "label" text NOT NULL,
  "description" text NOT NULL,
  "body_template" text NOT NULL,
  "link_path" text,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "scheduled_sms_jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tasting_id" uuid REFERENCES "public"."tastings"("id") ON DELETE cascade ON UPDATE no action,
  "user_id" uuid REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action,
  "template_key" text NOT NULL,
  "phone_number" text NOT NULL,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "send_at" timestamp with time zone NOT NULL,
  "sent_at" timestamp with time zone,
  "status" text DEFAULT 'pending' NOT NULL,
  "last_error" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "scheduled_sms_jobs_send_at_idx" ON "scheduled_sms_jobs" ("send_at");
CREATE INDEX IF NOT EXISTS "scheduled_sms_jobs_status_idx" ON "scheduled_sms_jobs" ("status");
