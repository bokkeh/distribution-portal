ALTER TABLE "inventory" ADD COLUMN IF NOT EXISTS "loose_bottle_sample" integer DEFAULT 0 NOT NULL;
ALTER TABLE "inventory_sample_holders" ADD COLUMN IF NOT EXISTS "loose_bottle_quantity" integer DEFAULT 0 NOT NULL;
ALTER TABLE "inventory_transactions" ADD COLUMN IF NOT EXISTS "delta_warehouse_bottles" integer DEFAULT 0 NOT NULL;
ALTER TABLE "inventory_transactions" ADD COLUMN IF NOT EXISTS "delta_sample_bottles" integer DEFAULT 0 NOT NULL;
ALTER TABLE "inventory_transactions" ADD COLUMN IF NOT EXISTS "warehouse_bottles_after" integer DEFAULT 0 NOT NULL;
ALTER TABLE "inventory_transactions" ADD COLUMN IF NOT EXISTS "sample_bottles_after" integer DEFAULT 0 NOT NULL;
ALTER TABLE "inventory_transactions" ADD COLUMN IF NOT EXISTS "checked_out_bottles_after" integer DEFAULT 0 NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_sample_holders_product_user_unique" ON "inventory_sample_holders" ("product_id", "user_id");
