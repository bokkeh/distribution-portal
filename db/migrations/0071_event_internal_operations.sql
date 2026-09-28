ALTER TABLE "events" ALTER COLUMN "start_at" DROP NOT NULL;
ALTER TABLE "events" ALTER COLUMN "end_at" DROP NOT NULL;

ALTER TABLE "events" ADD COLUMN "team_arrival_at" timestamp with time zone;
ALTER TABLE "events" ADD COLUMN "setup_at" timestamp with time zone;
ALTER TABLE "events" ADD COLUMN "breakdown_at" timestamp with time zone;
ALTER TABLE "events" ADD COLUMN "parking_instructions" text;
ALTER TABLE "events" ADD COLUMN "unloading_instructions" text;
ALTER TABLE "events" ADD COLUMN "internal_logistics_notes" text;
ALTER TABLE "events" ADD COLUMN "dress_code" text;
ALTER TABLE "events" ADD COLUMN "planning_poc_contact_id" uuid REFERENCES "contacts"("id") ON DELETE SET NULL;
ALTER TABLE "events" ADD COLUMN "planning_poc_name" text;
ALTER TABLE "events" ADD COLUMN "planning_poc_email" text;
ALTER TABLE "events" ADD COLUMN "planning_poc_phone" text;
ALTER TABLE "events" ADD COLUMN "day_of_poc_contact_id" uuid REFERENCES "contacts"("id") ON DELETE SET NULL;
ALTER TABLE "events" ADD COLUMN "day_of_poc_name" text;
ALTER TABLE "events" ADD COLUMN "day_of_poc_email" text;
ALTER TABLE "events" ADD COLUMN "day_of_poc_phone" text;
ALTER TABLE "events" ADD COLUMN "expected_attendees" integer;
ALTER TABLE "events" ADD COLUMN "estimated_people_served" integer;
ALTER TABLE "events" ADD COLUMN "actual_people_served" integer;
ALTER TABLE "events" ADD COLUMN "cocktails_served" jsonb DEFAULT '[]'::jsonb NOT NULL;
ALTER TABLE "events" ADD COLUMN "product_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;
ALTER TABLE "events" ADD COLUMN "estimated_product_required" text;
ALTER TABLE "events" ADD COLUMN "selling_product" boolean DEFAULT false NOT NULL;
ALTER TABLE "events" ADD COLUMN "sampling_product" boolean DEFAULT false NOT NULL;
ALTER TABLE "events" ADD COLUMN "wisher_provides" jsonb DEFAULT '[]'::jsonb NOT NULL;
ALTER TABLE "events" ADD COLUMN "partner_provides" jsonb DEFAULT '[]'::jsonb NOT NULL;
ALTER TABLE "events" ADD COLUMN "assigned_team_member_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;
ALTER TABLE "events" ADD COLUMN "donation_enabled" boolean DEFAULT false NOT NULL;
ALTER TABLE "events" ADD COLUMN "donation_type" text;
ALTER TABLE "events" ADD COLUMN "donation_value" numeric(12, 2);
ALTER TABLE "events" ADD COLUMN "donation_product_id" uuid REFERENCES "products"("id") ON DELETE SET NULL;
ALTER TABLE "events" ADD COLUMN "donation_quantity" numeric(10, 2);
ALTER TABLE "events" ADD COLUMN "donation_notes" text;
ALTER TABLE "events" ADD COLUMN "product_used" text;
ALTER TABLE "events" ADD COLUMN "bottles_used" numeric(10, 2);
ALTER TABLE "events" ADD COLUMN "cases_used" numeric(10, 2);
ALTER TABLE "events" ADD COLUMN "product_remaining" text;
ALTER TABLE "events" ADD COLUMN "sales_generated" numeric(12, 2);
ALTER TABLE "events" ADD COLUMN "leads_collected" integer;
ALTER TABLE "events" ADD COLUMN "internal_recap" text;
ALTER TABLE "events" ADD COLUMN "what_worked" text;
ALTER TABLE "events" ADD COLUMN "what_didnt" text;
ALTER TABLE "events" ADD COLUMN "follow_up_actions" text;
ALTER TABLE "events" ADD COLUMN "archived_at" timestamp with time zone;

CREATE INDEX "events_archived_at_idx" ON "events" ("archived_at");

ALTER TABLE "event_reminders" DROP CONSTRAINT IF EXISTS "event_reminders_reminder_type_check";
ALTER TABLE "event_reminders" ADD CONSTRAINT "event_reminders_reminder_type_check" CHECK ("reminder_type" IN ('seven_days','twenty_four_hours','morning_of','two_hours','thank_you'));
ALTER TABLE "event_reminders" ADD COLUMN "audience" text DEFAULT 'participants' NOT NULL CHECK ("audience" IN ('participants','internal'));
ALTER TABLE "event_reminders" ADD COLUMN "include_owner" boolean DEFAULT false NOT NULL;
ALTER TABLE "event_reminders" ADD COLUMN "include_assigned_team" boolean DEFAULT false NOT NULL;
ALTER TABLE "event_reminders" ADD COLUMN "recipient_user_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;

INSERT INTO "event_reminders" ("event_id", "reminder_type", "offset_minutes", "channels")
SELECT "id", 'morning_of', 540, '["email"]'::jsonb
FROM "events"
ON CONFLICT ("event_id", "reminder_type") DO NOTHING;
