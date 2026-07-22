ALTER TABLE "tasting_reports" ADD COLUMN IF NOT EXISTS "missed_customers" integer;
ALTER TABLE "tasting_reports" ADD COLUMN IF NOT EXISTS "bottle_price_on_shelf" numeric(10, 2);
ALTER TABLE "tasting_reports" ADD COLUMN IF NOT EXISTS "bottles_in_stock" integer;
