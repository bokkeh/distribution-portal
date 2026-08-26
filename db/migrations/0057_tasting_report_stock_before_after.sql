ALTER TABLE "tasting_reports" RENAME COLUMN "bottles_in_stock" TO "bottles_in_stock_after";
ALTER TABLE "tasting_reports" ADD COLUMN "bottles_in_stock_before" integer;
