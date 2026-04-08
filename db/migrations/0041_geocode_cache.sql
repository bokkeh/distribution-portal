CREATE TABLE IF NOT EXISTS "geocode_cache" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "normalized_address" text NOT NULL,
  "original_address" text NOT NULL,
  "lat" double precision,
  "lng" double precision,
  "status" text DEFAULT 'ok' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "geocode_cache_normalized_address_idx"
  ON "geocode_cache" ("normalized_address");

CREATE INDEX IF NOT EXISTS "geocode_cache_status_updated_idx"
  ON "geocode_cache" ("status", "updated_at");
