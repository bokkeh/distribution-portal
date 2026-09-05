ALTER TABLE "account_inventory_adjustments"
ADD COLUMN "source_order_id" uuid;
--> statement-breakpoint
ALTER TABLE "account_inventory_adjustments"
ADD CONSTRAINT "account_inventory_adjustments_source_order_id_orders_id_fk"
FOREIGN KEY ("source_order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "account_inventory_adjustments"
DROP CONSTRAINT IF EXISTS "account_inventory_adjustments_change_type_check";
--> statement-breakpoint
ALTER TABLE "account_inventory_adjustments"
ADD CONSTRAINT "account_inventory_adjustments_change_type_check"
CHECK ("change_type" IN ('manual_add', 'manual_update', 'manual_remove', 'manual_edit', 'order_fulfillment'));
--> statement-breakpoint
CREATE UNIQUE INDEX "account_inventory_adjustments_source_order_product_uidx"
ON "account_inventory_adjustments" USING btree ("source_order_id", "product_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "account_inventory_on_hand_account_product_uidx"
ON "account_inventory_on_hand" USING btree ("account_id", "product_id");
