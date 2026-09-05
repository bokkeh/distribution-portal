ALTER TABLE "account_inventory_adjustments"
ADD COLUMN "recorded_bottles_on_hand" numeric(10, 2);
--> statement-breakpoint
UPDATE "account_inventory_adjustments"
SET "recorded_bottles_on_hand" = "resulting_bottles_on_hand"
WHERE "change_type" <> 'order_fulfillment';
