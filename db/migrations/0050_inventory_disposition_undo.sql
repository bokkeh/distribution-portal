ALTER TABLE "inventory_transactions" ADD COLUMN IF NOT EXISTS "sample_holder_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL;
ALTER TABLE "inventory_transactions" ADD COLUMN IF NOT EXISTS "sample_bottles" integer DEFAULT 0 NOT NULL;
ALTER TABLE "inventory_transactions" ADD COLUMN IF NOT EXISTS "reversed_at" timestamp with time zone;
ALTER TABLE "inventory_transactions" ADD COLUMN IF NOT EXISTS "reversed_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL;
