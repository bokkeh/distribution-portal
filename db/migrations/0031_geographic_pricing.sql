ALTER TABLE "customer_accounts"
ADD COLUMN "county" text;

CREATE TABLE "geographic_pricing_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"state_code" text NOT NULL,
	"county_name" text,
	"county_key" text,
	"rule_type" text NOT NULL,
	"case_price" numeric(10, 2) NOT NULL,
	"effective_start_date" timestamp with time zone NOT NULL,
	"effective_end_date" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "order_items"
ADD COLUMN "pricing_source" text;
--> statement-breakpoint
ALTER TABLE "order_items"
ADD COLUMN "pricing_rule_id" uuid;
--> statement-breakpoint
ALTER TABLE "order_items"
ADD COLUMN "pricing_state" text;
--> statement-breakpoint
ALTER TABLE "order_items"
ADD COLUMN "pricing_county" text;
--> statement-breakpoint
ALTER TABLE "geographic_pricing_rules"
ADD CONSTRAINT "geographic_pricing_rules_product_id_products_id_fk"
FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "geographic_pricing_rules"
ADD CONSTRAINT "geographic_pricing_rules_created_by_users_id_fk"
FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "geographic_pricing_rules"
ADD CONSTRAINT "geographic_pricing_rules_updated_by_users_id_fk"
FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "order_items"
ADD CONSTRAINT "order_items_pricing_rule_id_geographic_pricing_rules_id_fk"
FOREIGN KEY ("pricing_rule_id") REFERENCES "public"."geographic_pricing_rules"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "geographic_pricing_rules_product_state_idx" ON "geographic_pricing_rules" USING btree ("product_id","state_code");
--> statement-breakpoint
CREATE INDEX "geographic_pricing_rules_county_lookup_idx" ON "geographic_pricing_rules" USING btree ("state_code","county_key");
--> statement-breakpoint
CREATE INDEX "geographic_pricing_rules_active_window_idx" ON "geographic_pricing_rules" USING btree ("is_active","effective_start_date","effective_end_date");
--> statement-breakpoint
ALTER TABLE "geographic_pricing_rules"
ADD CONSTRAINT "geographic_pricing_rules_rule_type_check"
CHECK (
	("rule_type" = 'state' AND "county_name" IS NULL AND "county_key" IS NULL)
	OR
	("rule_type" = 'county' AND "county_name" IS NOT NULL AND "county_key" IS NOT NULL)
);
--> statement-breakpoint
ALTER TABLE "order_items"
ADD CONSTRAINT "order_items_pricing_source_check"
CHECK (
	"pricing_source" IS NULL
	OR "pricing_source" IN ('county_override', 'state_price', 'default_price')
);
