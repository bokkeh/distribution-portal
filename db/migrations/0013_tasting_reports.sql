CREATE TABLE IF NOT EXISTS "tasting_reports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tasting_id" uuid NOT NULL UNIQUE REFERENCES "public"."tastings"("id") ON DELETE cascade ON UPDATE no action,
  "submitted_by_user_id" uuid NOT NULL REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action,
  "actual_start_time" text,
  "actual_end_time" text,
  "samples_served" integer,
  "bottles_sold" integer,
  "cases_sold" integer,
  "consumer_interactions" integer,
  "account_feedback" text,
  "highlights" text,
  "issues" text,
  "follow_up_needed" boolean DEFAULT false NOT NULL,
  "follow_up_notes" text,
  "submitted_at" timestamp with time zone DEFAULT now() NOT NULL
);
