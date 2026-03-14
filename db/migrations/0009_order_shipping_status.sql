ALTER TABLE "orders"
ADD COLUMN IF NOT EXISTS "shipping_status" text DEFAULT 'not_scheduled' NOT NULL;
