CREATE TABLE "account_price_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "account_id" uuid NOT NULL REFERENCES "customer_accounts"("id") ON DELETE CASCADE,
  "product_id" uuid NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "price" numeric(10, 2) NOT NULL CHECK ("price" >= 0),
  "observed_on" date NOT NULL,
  "notes" text,
  "created_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "account_price_history_account_product_date_idx" ON "account_price_history" ("account_id", "product_id", "observed_on");
