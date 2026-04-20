ALTER TABLE "geographic_pricing_rules"
ALTER COLUMN "state_code" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "geographic_pricing_rules"
ADD COLUMN "account_id" uuid;
--> statement-breakpoint
ALTER TABLE "geographic_pricing_rules"
ADD COLUMN "business_type" text;
--> statement-breakpoint
ALTER TABLE "geographic_pricing_rules"
ADD CONSTRAINT "geographic_pricing_rules_account_id_customer_accounts_id_fk"
FOREIGN KEY ("account_id") REFERENCES "public"."customer_accounts"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
DROP INDEX IF EXISTS "geographic_pricing_rules_account_lookup_idx";
--> statement-breakpoint
CREATE INDEX "geographic_pricing_rules_account_lookup_idx" ON "geographic_pricing_rules" USING btree ("account_id","product_id");
--> statement-breakpoint
DROP INDEX IF EXISTS "geographic_pricing_rules_business_type_lookup_idx";
--> statement-breakpoint
CREATE INDEX "geographic_pricing_rules_business_type_lookup_idx" ON "geographic_pricing_rules" USING btree ("business_type","product_id");
--> statement-breakpoint
ALTER TABLE "geographic_pricing_rules"
DROP CONSTRAINT IF EXISTS "geographic_pricing_rules_rule_type_check";
--> statement-breakpoint
ALTER TABLE "geographic_pricing_rules"
ADD CONSTRAINT "geographic_pricing_rules_rule_type_check"
CHECK (
  ("rule_type" = 'state' AND "state_code" IS NOT NULL AND "county_name" IS NULL AND "county_key" IS NULL AND "account_id" IS NULL AND "business_type" IS NULL)
  OR
  ("rule_type" = 'county' AND "state_code" IS NOT NULL AND "county_name" IS NOT NULL AND "county_key" IS NOT NULL AND "account_id" IS NULL AND "business_type" IS NULL)
  OR
  ("rule_type" = 'account' AND "state_code" IS NULL AND "county_name" IS NULL AND "county_key" IS NULL AND "account_id" IS NOT NULL AND "business_type" IS NULL)
  OR
  ("rule_type" = 'business_type' AND "state_code" IS NULL AND "county_name" IS NULL AND "county_key" IS NULL AND "account_id" IS NULL AND "business_type" IS NOT NULL)
);
--> statement-breakpoint
ALTER TABLE "order_items"
DROP CONSTRAINT IF EXISTS "order_items_pricing_source_check";
--> statement-breakpoint
ALTER TABLE "order_items"
ADD CONSTRAINT "order_items_pricing_source_check"
CHECK (
  "pricing_source" IS NULL
  OR "pricing_source" IN ('account_special', 'county_override', 'business_type_price', 'state_price', 'default_price')
);
