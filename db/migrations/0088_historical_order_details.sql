ALTER TABLE historical_orders ADD COLUMN IF NOT EXISTS case_unit_price numeric(12,2);
--> statement-breakpoint
ALTER TABLE historical_orders ADD COLUMN IF NOT EXISTS bottle_unit_price numeric(12,2);
--> statement-breakpoint
ALTER TABLE historical_orders ADD COLUMN IF NOT EXISTS external_reference text;
--> statement-breakpoint
ALTER TABLE historical_orders ADD COLUMN IF NOT EXISTS payment_status text;
--> statement-breakpoint
ALTER TABLE historical_orders ADD COLUMN IF NOT EXISTS fulfillment_status text;
--> statement-breakpoint
ALTER TABLE historical_orders ADD COLUMN IF NOT EXISTS fingerprint text;
--> statement-breakpoint
ALTER TABLE historical_orders ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 1;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS historical_orders_fingerprint_uidx ON historical_orders(fingerprint);
--> statement-breakpoint
ALTER TABLE historical_orders ADD COLUMN IF NOT EXISTS duplicate_review_reason text;
