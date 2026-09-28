ALTER TABLE "account_inventory_adjustments" ADD COLUMN IF NOT EXISTS "activity_type" text NOT NULL DEFAULT 'manual_adjustment';
--> statement-breakpoint
UPDATE "account_inventory_adjustments" SET "activity_type" = 'order_delivered' WHERE "change_type" = 'order_fulfillment' AND "activity_type" = 'manual_adjustment';
