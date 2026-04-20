CREATE TABLE "account_inventory_adjustments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "account_id" uuid NOT NULL,
  "inventory_item_id" uuid,
  "product_id" uuid NOT NULL,
  "sku" text NOT NULL,
  "product_name" text NOT NULL,
  "change_type" text NOT NULL,
  "delta_cases" numeric(10, 2) DEFAULT '0' NOT NULL,
  "delta_bottles" numeric(10, 2) DEFAULT '0' NOT NULL,
  "resulting_cases_on_hand" numeric(10, 2) DEFAULT '0' NOT NULL,
  "resulting_bottles_on_hand" numeric(10, 2) DEFAULT '0' NOT NULL,
  "effective_at" timestamp with time zone DEFAULT now() NOT NULL,
  "notes" text,
  "created_by_user_id" uuid,
  "updated_by_user_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account_inventory_adjustments"
ADD CONSTRAINT "account_inventory_adjustments_account_id_customer_accounts_id_fk"
FOREIGN KEY ("account_id") REFERENCES "public"."customer_accounts"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "account_inventory_adjustments"
ADD CONSTRAINT "account_inventory_adjustments_inventory_item_id_account_inventory_on_hand_id_fk"
FOREIGN KEY ("inventory_item_id") REFERENCES "public"."account_inventory_on_hand"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "account_inventory_adjustments"
ADD CONSTRAINT "account_inventory_adjustments_product_id_products_id_fk"
FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "account_inventory_adjustments"
ADD CONSTRAINT "account_inventory_adjustments_created_by_user_id_users_id_fk"
FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "account_inventory_adjustments"
ADD CONSTRAINT "account_inventory_adjustments_updated_by_user_id_users_id_fk"
FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "account_inventory_adjustments_account_effective_idx" ON "account_inventory_adjustments" USING btree ("account_id","effective_at");
--> statement-breakpoint
CREATE INDEX "account_inventory_adjustments_account_product_effective_idx" ON "account_inventory_adjustments" USING btree ("account_id","product_id","effective_at");
--> statement-breakpoint
ALTER TABLE "account_inventory_adjustments"
ADD CONSTRAINT "account_inventory_adjustments_change_type_check"
CHECK ("change_type" IN ('manual_add', 'manual_update', 'manual_remove', 'manual_edit'));
