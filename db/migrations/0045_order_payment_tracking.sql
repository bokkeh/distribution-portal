ALTER TABLE "orders"
ADD COLUMN "stripe_payment_intent_id" text;
--> statement-breakpoint
ALTER TABLE "orders"
ADD COLUMN "payment_status" text DEFAULT 'not_applicable' NOT NULL;
--> statement-breakpoint
ALTER TABLE "orders"
ADD COLUMN "paid_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "orders"
ADD CONSTRAINT "orders_payment_status_check"
CHECK ("payment_status" IN ('not_applicable', 'requires_action', 'processing', 'paid', 'failed', 'canceled'));
--> statement-breakpoint
CREATE UNIQUE INDEX "orders_stripe_payment_intent_id_idx"
ON "orders" USING btree ("stripe_payment_intent_id")
WHERE "stripe_payment_intent_id" IS NOT NULL;
