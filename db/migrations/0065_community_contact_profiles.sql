ALTER TABLE "community_contacts" ADD COLUMN IF NOT EXISTS "address_line_1" text;
ALTER TABLE "community_contacts" ADD COLUMN IF NOT EXISTS "address_line_2" text;
ALTER TABLE "community_contacts" ADD COLUMN IF NOT EXISTS "city" text;
ALTER TABLE "community_contacts" ADD COLUMN IF NOT EXISTS "state" text;
ALTER TABLE "community_contacts" ADD COLUMN IF NOT EXISTS "postal_code" text;
ALTER TABLE "community_contacts" ADD COLUMN IF NOT EXISTS "country" text DEFAULT 'US' NOT NULL;

CREATE TABLE IF NOT EXISTS "community_contact_notes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "community_contact_id" uuid NOT NULL REFERENCES "community_contacts"("id") ON DELETE CASCADE,
  "body" text NOT NULL,
  "author_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "community_contact_notes_contact_created_idx" ON "community_contact_notes" ("community_contact_id", "created_at");

CREATE TABLE IF NOT EXISTS "community_event_attendance" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "community_contact_id" uuid NOT NULL REFERENCES "community_contacts"("id") ON DELETE CASCADE,
  "tasting_id" uuid NOT NULL REFERENCES "tastings"("id") ON DELETE CASCADE,
  "attended_at" timestamp with time zone NOT NULL,
  "notes" text,
  "created_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "community_event_attendance_contact_tasting_uidx" ON "community_event_attendance" ("community_contact_id", "tasting_id");
CREATE INDEX IF NOT EXISTS "community_event_attendance_contact_idx" ON "community_event_attendance" ("community_contact_id", "attended_at");
CREATE INDEX IF NOT EXISTS "community_event_attendance_tasting_idx" ON "community_event_attendance" ("tasting_id");

CREATE TABLE IF NOT EXISTS "community_contact_communications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "community_contact_id" uuid NOT NULL REFERENCES "community_contacts"("id") ON DELETE CASCADE,
  "channel" text NOT NULL,
  "direction" text DEFAULT 'outbound' NOT NULL,
  "subject" text,
  "body" text NOT NULL,
  "status" text NOT NULL,
  "actor_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "community_contact_communications_channel_check" CHECK ("channel" = 'email'),
  CONSTRAINT "community_contact_communications_direction_check" CHECK ("direction" = 'outbound'),
  CONSTRAINT "community_contact_communications_status_check" CHECK ("status" IN ('sent', 'failed'))
);
CREATE INDEX IF NOT EXISTS "community_contact_communications_contact_idx" ON "community_contact_communications" ("community_contact_id", "occurred_at");
