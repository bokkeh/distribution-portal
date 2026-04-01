CREATE TABLE "account_notes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "account_id" uuid NOT NULL REFERENCES "customer_accounts"("id") ON DELETE cascade,
  "note_body" text NOT NULL,
  "note_type" text DEFAULT 'general_update' NOT NULL,
  "author_user_id" uuid REFERENCES "users"("id") ON DELETE set null,
  "author_role" text DEFAULT 'system' NOT NULL,
  "is_pinned" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX "account_notes_account_created_idx" ON "account_notes" ("account_id", "created_at");

CREATE TABLE "account_inventory_on_hand" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "account_id" uuid NOT NULL REFERENCES "customer_accounts"("id") ON DELETE cascade,
  "product_id" uuid NOT NULL REFERENCES "products"("id") ON DELETE cascade,
  "sku" text NOT NULL,
  "product_name" text NOT NULL,
  "unit_type" text,
  "quantity_on_hand" numeric(10, 2) DEFAULT '0' NOT NULL,
  "updated_by_user_id" uuid REFERENCES "users"("id") ON DELETE set null,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX "account_inventory_on_hand_account_updated_idx" ON "account_inventory_on_hand" ("account_id", "updated_at");
CREATE INDEX "account_inventory_on_hand_account_product_idx" ON "account_inventory_on_hand" ("account_id", "product_id");
