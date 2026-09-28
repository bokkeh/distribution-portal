ALTER TABLE "customer_accounts" ADD COLUMN IF NOT EXISTS "member_since" date;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "historical_orders" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "account_id" uuid NOT NULL REFERENCES "customer_accounts"("id") ON DELETE CASCADE,
  "order_date" timestamptz NOT NULL,
  "product_id" uuid REFERENCES "products"("id") ON DELETE SET NULL,
  "product_name_freeform" text,
  "cases" numeric(10, 2) NOT NULL DEFAULT '0',
  "bottles" numeric(10, 2) NOT NULL DEFAULT '0',
  "order_value" numeric(12, 2),
  "notes" text,
  "source" text NOT NULL DEFAULT 'manual_historical',
  "created_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "historical_orders_account_order_date_idx" ON "historical_orders" ("account_id", "order_date");
