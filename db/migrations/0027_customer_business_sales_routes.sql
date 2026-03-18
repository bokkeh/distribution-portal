ALTER TABLE "customer_accounts"
ADD COLUMN IF NOT EXISTS "business_type" text,
ADD COLUMN IF NOT EXISTS "liquor_license_number" text,
ADD COLUMN IF NOT EXISTS "liquor_license_state" text,
ADD COLUMN IF NOT EXISTS "liquor_license_expiration" text,
ADD COLUMN IF NOT EXISTS "liquor_license_url" text;

ALTER TABLE "wholesale_account_requests"
ADD COLUMN IF NOT EXISTS "business_type" text;

ALTER TABLE "sales_routes"
ADD COLUMN IF NOT EXISTS "region" text,
ADD COLUMN IF NOT EXISTS "assigned_rep_user_id" uuid REFERENCES "users"("id"),
ADD COLUMN IF NOT EXISTS "hourly_rate" numeric(10, 2);

ALTER TABLE "sales_route_stops"
ADD COLUMN IF NOT EXISTS "visit_photo_url" text,
ADD COLUMN IF NOT EXISTS "visited_at" timestamp with time zone;
