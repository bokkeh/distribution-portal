ALTER TABLE "orders"
ADD COLUMN "payment_method" text;
--> statement-breakpoint
ALTER TABLE "orders"
DROP CONSTRAINT IF EXISTS "orders_payment_status_check";
--> statement-breakpoint
ALTER TABLE "orders"
ALTER COLUMN "payment_status" SET DEFAULT 'unpaid';
--> statement-breakpoint
UPDATE "orders"
SET "payment_method" = 'stripe'
WHERE "stripe_payment_intent_id" IS NOT NULL;
--> statement-breakpoint
UPDATE "orders"
SET "payment_method" = 'cod'
WHERE "stripe_payment_intent_id" IS NULL
  AND UPPER(COALESCE("payment_terms", '')) = 'COD';
--> statement-breakpoint
UPDATE "orders"
SET "payment_status" = 'unpaid'
WHERE "order_type" = 'paid'
  AND "payment_status" = 'not_applicable'
  AND "stripe_payment_intent_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "orders"
ADD CONSTRAINT "orders_payment_status_check"
CHECK ("payment_status" IN ('not_applicable', 'unpaid', 'requires_action', 'processing', 'paid', 'failed', 'canceled'));
--> statement-breakpoint
ALTER TABLE "orders"
ADD CONSTRAINT "orders_payment_method_check"
CHECK ("payment_method" IS NULL OR "payment_method" IN ('stripe', 'check', 'cod', 'manual'));
