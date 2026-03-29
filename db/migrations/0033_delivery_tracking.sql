ALTER TABLE "delivery_stops"
  ADD COLUMN "tracking_enabled" boolean DEFAULT false NOT NULL,
  ADD COLUMN "tracking_token" text,
  ADD COLUMN "tracking_token_created_at" timestamp with time zone,
  ADD COLUMN "tracking_expires_at" timestamp with time zone,
  ADD COLUMN "customer_status" text DEFAULT 'not_started' NOT NULL,
  ADD COLUMN "out_for_delivery_at" timestamp with time zone,
  ADD COLUMN "arriving_soon_at" timestamp with time zone,
  ADD COLUMN "arrived_at" timestamp with time zone,
  ADD COLUMN "delivered_at" timestamp with time zone,
  ADD COLUMN "eta_minutes" integer,
  ADD COLUMN "distance_miles" numeric(8, 2),
  ADD COLUMN "last_known_driver_lat" numeric(10, 7),
  ADD COLUMN "last_known_driver_lng" numeric(10, 7),
  ADD COLUMN "last_location_at" timestamp with time zone,
  ADD COLUMN "recipient_signature_url" text,
  ADD COLUMN "recipient_signed_name" text,
  ADD COLUMN "recipient_signed_at" timestamp with time zone;

CREATE UNIQUE INDEX IF NOT EXISTS "delivery_stops_tracking_token_unique" ON "delivery_stops" ("tracking_token");

CREATE TABLE IF NOT EXISTS "delivery_notifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "delivery_id" uuid NOT NULL REFERENCES "deliveries"("id") ON DELETE cascade,
  "stop_id" uuid NOT NULL REFERENCES "delivery_stops"("id") ON DELETE cascade,
  "customer_id" uuid REFERENCES "customer_accounts"("id") ON DELETE set null,
  "notification_type" text NOT NULL,
  "channel" text NOT NULL,
  "message_body" text NOT NULL,
  "media_url" text,
  "provider" text DEFAULT 'telnyx' NOT NULL,
  "provider_message_id" text,
  "status" text DEFAULT 'pending' NOT NULL,
  "sent_at" timestamp with time zone,
  "delivered_at" timestamp with time zone,
  "failed_at" timestamp with time zone,
  "failure_reason" text,
  "created_by" uuid REFERENCES "users"("id") ON DELETE set null,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "delivery_notifications_stop_type_idx" ON "delivery_notifications" ("stop_id", "notification_type");

CREATE TABLE IF NOT EXISTS "delivery_location_updates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "delivery_id" uuid NOT NULL REFERENCES "deliveries"("id") ON DELETE cascade,
  "stop_id" uuid REFERENCES "delivery_stops"("id") ON DELETE cascade,
  "driver_id" uuid NOT NULL REFERENCES "drivers"("id") ON DELETE cascade,
  "lat" numeric(10, 7) NOT NULL,
  "lng" numeric(10, 7) NOT NULL,
  "source" text DEFAULT 'driver_browser' NOT NULL,
  "recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "delivery_location_updates_delivery_recorded_idx" ON "delivery_location_updates" ("delivery_id", "recorded_at");

CREATE TABLE IF NOT EXISTS "delivery_tracking_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "delivery_id" uuid NOT NULL REFERENCES "deliveries"("id") ON DELETE cascade,
  "stop_id" uuid REFERENCES "delivery_stops"("id") ON DELETE cascade,
  "event_type" text NOT NULL,
  "event_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_by" uuid REFERENCES "users"("id") ON DELETE set null,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "delivery_tracking_events_delivery_event_idx" ON "delivery_tracking_events" ("delivery_id", "created_at");
