ALTER TABLE "tasting_reports"
ADD COLUMN "missed_customers" integer,
ADD COLUMN "bottle_price_on_shelf" numeric(10, 2),
ADD COLUMN "bottles_in_stock" integer;
