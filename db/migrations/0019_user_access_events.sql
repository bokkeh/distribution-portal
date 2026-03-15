CREATE TABLE IF NOT EXISTS "user_access_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action,
  "event_type" text NOT NULL,
  "provider" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "user_access_events_user_id_idx" ON "user_access_events" ("user_id");
CREATE INDEX IF NOT EXISTS "user_access_events_created_at_idx" ON "user_access_events" ("created_at");
