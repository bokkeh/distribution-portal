ALTER TABLE "geographic_pricing_rules"
ADD COLUMN "min_case_quantity" integer;
--> statement-breakpoint
ALTER TABLE "geographic_pricing_rules"
ADD COLUMN "max_case_quantity" integer;
--> statement-breakpoint
ALTER TABLE "geographic_pricing_rules"
ADD CONSTRAINT "geographic_pricing_rules_min_case_quantity_check"
CHECK ("min_case_quantity" IS NULL OR "min_case_quantity" > 0);
--> statement-breakpoint
ALTER TABLE "geographic_pricing_rules"
ADD CONSTRAINT "geographic_pricing_rules_max_case_quantity_check"
CHECK ("max_case_quantity" IS NULL OR "max_case_quantity" > 0);
--> statement-breakpoint
ALTER TABLE "geographic_pricing_rules"
ADD CONSTRAINT "geographic_pricing_rules_quantity_window_check"
CHECK (
  "min_case_quantity" IS NULL
  OR "max_case_quantity" IS NULL
  OR "min_case_quantity" <= "max_case_quantity"
);
