ALTER TABLE "community_contacts" ADD COLUMN IF NOT EXISTS "sms_consent_at" timestamp with time zone;
ALTER TABLE "community_contacts" DROP CONSTRAINT IF EXISTS "community_contacts_source_check";
ALTER TABLE "community_contacts" ADD CONSTRAINT "community_contacts_source_check" CHECK ("source" IN ('public_signup', 'admin_entry', 'import', 'event_rsvp', 'event_manual', 'event_import'));

CREATE TABLE IF NOT EXISTS "events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "slug" text NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "event_type" text DEFAULT 'community_event' NOT NULL CHECK ("event_type" IN ('party','pop_up','festival','community_event','retail_activation','partner_event','dinner','sponsorship','sports_event','trade_event','other')),
  "start_at" timestamp with time zone NOT NULL,
  "end_at" timestamp with time zone NOT NULL,
  "time_zone" text DEFAULT 'America/New_York' NOT NULL,
  "status" text DEFAULT 'draft' NOT NULL CHECK ("status" IN ('draft','scheduled','cancelled','completed')),
  "visibility" text DEFAULT 'draft' NOT NULL CHECK ("visibility" IN ('draft','public','link_only','closed')),
  "organizer_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "account_id" uuid REFERENCES "customer_accounts"("id") ON DELETE SET NULL,
  "location_mode" text DEFAULT 'manual' NOT NULL CHECK ("location_mode" IN ('manual','account')),
  "venue_name" text,
  "address_line_1" text,
  "address_line_2" text,
  "city" text,
  "state" text,
  "postal_code" text,
  "country" text DEFAULT 'US' NOT NULL,
  "venue_contact_name" text,
  "venue_phone" text,
  "venue_website" text,
  "source_channel" text,
  "rsvp_optional_fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "attendee_upload_policy" text DEFAULT 'approval' NOT NULL CHECK ("attendee_upload_policy" IN ('disabled','immediate','approval','private')),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "events_slug_uidx" ON "events" ("slug");
CREATE INDEX IF NOT EXISTS "events_start_at_idx" ON "events" ("start_at");
CREATE INDEX IF NOT EXISTS "events_status_idx" ON "events" ("status");
CREATE INDEX IF NOT EXISTS "events_account_idx" ON "events" ("account_id");
CREATE INDEX IF NOT EXISTS "events_organizer_idx" ON "events" ("organizer_user_id");

CREATE TABLE IF NOT EXISTS "event_participants" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "event_id" uuid NOT NULL REFERENCES "events"("id") ON DELETE CASCADE,
  "community_contact_id" uuid NOT NULL REFERENCES "community_contacts"("id") ON DELETE CASCADE,
  "rsvp_status" text DEFAULT 'confirmed' NOT NULL CHECK ("rsvp_status" IN ('confirmed','maybe','declined')),
  "attendance_status" text DEFAULT 'not_checked_in' NOT NULL CHECK ("attendance_status" IN ('not_checked_in','checked_in','no_show')),
  "source" text DEFAULT 'manual' NOT NULL CHECK ("source" IN ('public_rsvp','manual','import')),
  "guest_count" integer DEFAULT 0 NOT NULL,
  "guest_names" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "company" text,
  "instagram_handle" text,
  "notes" text,
  "marketing_consent" boolean DEFAULT false NOT NULL,
  "sms_consent" boolean DEFAULT false NOT NULL,
  "management_token" uuid DEFAULT gen_random_uuid() NOT NULL,
  "checked_in_at" timestamp with time zone,
  "created_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "event_participants_event_contact_uidx" ON "event_participants" ("event_id", "community_contact_id");
CREATE UNIQUE INDEX IF NOT EXISTS "event_participants_management_token_uidx" ON "event_participants" ("management_token");
CREATE INDEX IF NOT EXISTS "event_participants_event_idx" ON "event_participants" ("event_id");
CREATE INDEX IF NOT EXISTS "event_participants_contact_idx" ON "event_participants" ("community_contact_id");
CREATE INDEX IF NOT EXISTS "event_participants_rsvp_idx" ON "event_participants" ("event_id", "rsvp_status");
CREATE INDEX IF NOT EXISTS "event_participants_attendance_idx" ON "event_participants" ("event_id", "attendance_status");

CREATE TABLE IF NOT EXISTS "event_media" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "event_id" uuid NOT NULL REFERENCES "events"("id") ON DELETE CASCADE,
  "storage_path" text NOT NULL,
  "file_name" text NOT NULL,
  "content_type" text NOT NULL,
  "media_type" text NOT NULL CHECK ("media_type" IN ('image','video','pdf','document')),
  "placement" text DEFAULT 'gallery' NOT NULL CHECK ("placement" IN ('hero','gallery','promotional','attachment','internal')),
  "upload_source" text DEFAULT 'organizer' NOT NULL CHECK ("upload_source" IN ('organizer','attendee')),
  "approval_status" text DEFAULT 'approved' NOT NULL CHECK ("approval_status" IN ('pending','approved','rejected','private')),
  "uploaded_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "uploaded_by_contact_id" uuid REFERENCES "community_contacts"("id") ON DELETE SET NULL,
  "uploader_name" text,
  "uploader_email" text,
  "caption" text,
  "featured" boolean DEFAULT false NOT NULL,
  "reviewed_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "reviewed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "event_media_event_created_idx" ON "event_media" ("event_id", "created_at");
CREATE INDEX IF NOT EXISTS "event_media_event_approval_idx" ON "event_media" ("event_id", "approval_status");

CREATE TABLE IF NOT EXISTS "event_communications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "event_id" uuid NOT NULL REFERENCES "events"("id") ON DELETE CASCADE,
  "channel" text NOT NULL CHECK ("channel" IN ('email','sms')),
  "audience" text NOT NULL,
  "message_type" text NOT NULL,
  "subject" text,
  "body" text NOT NULL,
  "status" text NOT NULL CHECK ("status" IN ('sent','partial','failed')),
  "recipient_count" integer DEFAULT 0 NOT NULL,
  "sent_count" integer DEFAULT 0 NOT NULL,
  "failed_count" integer DEFAULT 0 NOT NULL,
  "actor_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "event_communications_event_sent_idx" ON "event_communications" ("event_id", "sent_at");

CREATE TABLE IF NOT EXISTS "event_reminders" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "event_id" uuid NOT NULL REFERENCES "events"("id") ON DELETE CASCADE,
  "reminder_type" text NOT NULL CHECK ("reminder_type" IN ('seven_days','twenty_four_hours','two_hours','thank_you')),
  "offset_minutes" integer NOT NULL,
  "channels" jsonb DEFAULT '["email"]'::jsonb NOT NULL,
  "enabled" boolean DEFAULT false NOT NULL,
  "last_sent_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "event_reminders_event_type_uidx" ON "event_reminders" ("event_id", "reminder_type");
CREATE INDEX IF NOT EXISTS "event_reminders_enabled_idx" ON "event_reminders" ("enabled");
