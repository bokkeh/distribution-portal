CREATE TABLE IF NOT EXISTS "inventory_locations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL UNIQUE,
  "type" text NOT NULL CHECK ("type" IN ('warehouse', 'sample')),
  "owner_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "region" text,
  "address" text,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "inventory_location_balances" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "location_id" uuid NOT NULL REFERENCES "inventory_locations"("id") ON DELETE CASCADE,
  "product_id" uuid NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "quantity_cases" integer DEFAULT 0 NOT NULL CHECK ("quantity_cases" >= 0),
  "quantity_bottles" integer DEFAULT 0 NOT NULL CHECK ("quantity_bottles" >= 0),
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_location_balances_location_product_uidx" ON "inventory_location_balances" ("location_id", "product_id");
CREATE INDEX IF NOT EXISTS "inventory_location_balances_product_idx" ON "inventory_location_balances" ("product_id");

CREATE TABLE IF NOT EXISTS "inventory_location_thresholds" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "location_id" uuid NOT NULL REFERENCES "inventory_locations"("id") ON DELETE CASCADE,
  "product_id" uuid NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "minimum_cases" integer DEFAULT 0 NOT NULL CHECK ("minimum_cases" >= 0),
  "minimum_bottles" integer DEFAULT 0 NOT NULL CHECK ("minimum_bottles" >= 0),
  "updated_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_location_thresholds_location_product_uidx" ON "inventory_location_thresholds" ("location_id", "product_id");

CREATE TABLE IF NOT EXISTS "sample_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "request_number" text DEFAULT ('SR-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))) NOT NULL UNIQUE,
  "idempotency_key" text NOT NULL UNIQUE,
  "status" text DEFAULT 'draft' NOT NULL CHECK ("status" IN ('draft','submitted','approved','fulfilled','partially_fulfilled','cancelled','reversed')),
  "source_location_id" uuid NOT NULL REFERENCES "inventory_locations"("id"),
  "responsible_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "recipient_type" text NOT NULL CHECK ("recipient_type" IN ('customer','prospect','event','charity','internal','other')),
  "recipient_name" text NOT NULL,
  "recipient_email" text,
  "recipient_details" text,
  "quickbooks_category" text NOT NULL CHECK ("quickbooks_category" IN ('Tastings','Events (IRL)','Events (URL)','Giveaways','Charity Donations','Sales Calls')),
  "customer_account_id" uuid REFERENCES "customer_accounts"("id") ON DELETE SET NULL,
  "order_id" uuid REFERENCES "orders"("id") ON DELETE SET NULL,
  "invoice_id" uuid REFERENCES "invoices"("id") ON DELETE SET NULL,
  "purpose" text NOT NULL,
  "notes" text,
  "replenish_from_warehouse" boolean DEFAULT false NOT NULL,
  "total_estimated_cost" numeric(12,2) DEFAULT 0 NOT NULL,
  "requested_by_user_id" uuid NOT NULL REFERENCES "users"("id"),
  "approved_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "fulfilled_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "submitted_at" timestamptz,
  "approved_at" timestamptz,
  "fulfilled_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "sample_requests_status_idx" ON "sample_requests" ("status");
CREATE INDEX IF NOT EXISTS "sample_requests_source_location_idx" ON "sample_requests" ("source_location_id");
CREATE INDEX IF NOT EXISTS "sample_requests_created_at_idx" ON "sample_requests" ("created_at");

CREATE TABLE IF NOT EXISTS "sample_request_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "sample_request_id" uuid NOT NULL REFERENCES "sample_requests"("id") ON DELETE CASCADE,
  "product_id" uuid NOT NULL REFERENCES "products"("id"),
  "quantity_cases" integer DEFAULT 0 NOT NULL CHECK ("quantity_cases" >= 0),
  "quantity_bottles" integer DEFAULT 0 NOT NULL CHECK ("quantity_bottles" >= 0),
  "estimated_unit_cost" numeric(12,2) DEFAULT 0 NOT NULL,
  "estimated_total_cost" numeric(12,2) DEFAULT 0 NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CHECK ("quantity_cases" > 0 OR "quantity_bottles" > 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS "sample_request_items_request_product_uidx" ON "sample_request_items" ("sample_request_id", "product_id");

CREATE TABLE IF NOT EXISTS "sample_request_status_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "sample_request_id" uuid NOT NULL REFERENCES "sample_requests"("id") ON DELETE CASCADE,
  "from_status" text,
  "to_status" text NOT NULL,
  "note" text,
  "actor_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "inventory_location_movements" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "idempotency_key" text NOT NULL UNIQUE,
  "type" text NOT NULL CHECK ("type" IN ('opening_balance','adjustment','sample_usage','replenishment','transfer','return','reversal')),
  "product_id" uuid NOT NULL REFERENCES "products"("id"),
  "source_location_id" uuid REFERENCES "inventory_locations"("id"),
  "destination_location_id" uuid REFERENCES "inventory_locations"("id"),
  "quantity_cases" integer DEFAULT 0 NOT NULL CHECK ("quantity_cases" >= 0),
  "quantity_bottles" integer DEFAULT 0 NOT NULL CHECK ("quantity_bottles" >= 0),
  "sample_request_id" uuid REFERENCES "sample_requests"("id") ON DELETE SET NULL,
  "customer_account_id" uuid REFERENCES "customer_accounts"("id") ON DELETE SET NULL,
  "order_id" uuid REFERENCES "orders"("id") ON DELETE SET NULL,
  "invoice_id" uuid REFERENCES "invoices"("id") ON DELETE SET NULL,
  "quickbooks_category" text CHECK ("quickbooks_category" IS NULL OR "quickbooks_category" IN ('Tastings','Events (IRL)','Events (URL)','Giveaways','Charity Donations','Sales Calls')),
  "estimated_cost" numeric(12,2) DEFAULT 0 NOT NULL,
  "reason" text NOT NULL,
  "actor_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "approved_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "reversal_of_movement_id" uuid REFERENCES "inventory_location_movements"("id") ON DELETE RESTRICT,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CHECK ("quantity_cases" > 0 OR "quantity_bottles" > 0),
  CHECK ("source_location_id" IS NOT NULL OR "destination_location_id" IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS "inventory_location_movements_created_at_idx" ON "inventory_location_movements" ("created_at");
CREATE INDEX IF NOT EXISTS "inventory_location_movements_product_idx" ON "inventory_location_movements" ("product_id");
CREATE INDEX IF NOT EXISTS "inventory_location_movements_request_idx" ON "inventory_location_movements" ("sample_request_id");

CREATE TABLE IF NOT EXISTS "replenishment_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "idempotency_key" text NOT NULL UNIQUE,
  "sample_request_id" uuid REFERENCES "sample_requests"("id") ON DELETE SET NULL,
  "source_location_id" uuid NOT NULL REFERENCES "inventory_locations"("id"),
  "destination_location_id" uuid NOT NULL REFERENCES "inventory_locations"("id"),
  "product_id" uuid NOT NULL REFERENCES "products"("id"),
  "requested_cases" integer DEFAULT 0 NOT NULL,
  "requested_bottles" integer DEFAULT 0 NOT NULL,
  "fulfilled_cases" integer DEFAULT 0 NOT NULL,
  "fulfilled_bottles" integer DEFAULT 0 NOT NULL,
  "status" text DEFAULT 'requested' NOT NULL CHECK ("status" IN ('requested','approved','partially_fulfilled','fulfilled','cancelled')),
  "requested_by_user_id" uuid NOT NULL REFERENCES "users"("id"),
  "approved_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "fulfilled_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "notes" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "fulfilled_at" timestamptz
);
CREATE INDEX IF NOT EXISTS "replenishment_requests_status_idx" ON "replenishment_requests" ("status");

CREATE TABLE IF NOT EXISTS "quickbooks_category_mappings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "category" text NOT NULL UNIQUE CHECK ("category" IN ('Tastings','Events (IRL)','Events (URL)','Giveaways','Charity Donations','Sales Calls')),
  "account_id" text, "account_name" text, "class_id" text, "class_name" text,
  "department_id" text, "location_id" text, "customer_project_id" text, "memo_template" text,
  "auto_export" boolean DEFAULT false NOT NULL,
  "requires_approval" boolean DEFAULT true NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "updated_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "quickbooks_exports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "idempotency_key" text NOT NULL UNIQUE,
  "sample_request_id" uuid NOT NULL UNIQUE REFERENCES "sample_requests"("id") ON DELETE CASCADE,
  "mapping_id" uuid REFERENCES "quickbooks_category_mappings"("id") ON DELETE SET NULL,
  "status" text NOT NULL CHECK ("status" IN ('pending_mapping','pending_approval','ready','exported','failed','skipped')),
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "external_transaction_id" text,
  "attempt_count" integer DEFAULT 0 NOT NULL,
  "last_error" text,
  "approved_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "exported_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "exported_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "quickbooks_exports_status_idx" ON "quickbooks_exports" ("status");

CREATE TABLE IF NOT EXISTS "inventory_low_stock_alerts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "location_id" uuid NOT NULL REFERENCES "inventory_locations"("id") ON DELETE CASCADE,
  "product_id" uuid NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "status" text DEFAULT 'open' NOT NULL CHECK ("status" IN ('open','acknowledged','resolved')),
  "current_cases" integer NOT NULL, "current_bottles" integer NOT NULL,
  "minimum_cases" integer NOT NULL, "minimum_bottles" integer NOT NULL,
  "acknowledged_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "acknowledged_at" timestamptz, "resolved_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "inventory_low_stock_alerts_status_idx" ON "inventory_low_stock_alerts" ("status");
CREATE INDEX IF NOT EXISTS "inventory_low_stock_alerts_location_product_idx" ON "inventory_low_stock_alerts" ("location_id", "product_id");
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_low_stock_alerts_one_open_uidx" ON "inventory_low_stock_alerts" ("location_id", "product_id") WHERE "status" = 'open';

CREATE TABLE IF NOT EXISTS "monthly_inventory_reports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "report_month" text NOT NULL UNIQUE,
  "status" text DEFAULT 'generating' NOT NULL CHECK ("status" IN ('generating','ready','sending','sent','partially_sent','failed')),
  "summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "csv_content" text,
  "recipient_emails" text[] DEFAULT ARRAY[]::text[] NOT NULL,
  "sent_recipient_emails" text[] DEFAULT ARRAY[]::text[] NOT NULL,
  "last_error" text,
  "generated_at" timestamptz, "sent_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

INSERT INTO "inventory_locations" ("name", "type", "region") VALUES
  ('Warehouse - Landover', 'warehouse', 'Landover'),
  ('Kim - Samples Maryland', 'sample', 'Maryland'),
  ('Emily - Samples Chicago', 'sample', 'Chicago'),
  ('Kristen - Samples Kildeer', 'sample', 'Kildeer')
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "quickbooks_category_mappings" ("category") VALUES
  ('Tastings'), ('Events (IRL)'), ('Events (URL)'), ('Giveaways'), ('Charity Donations'), ('Sales Calls')
ON CONFLICT ("category") DO NOTHING;

-- Preserve legacy inventory without guessing how samples are distributed. Seed the
-- main warehouse from paid stock only; all opening balance corrections are audited
-- through the new movement workflow after migration.
INSERT INTO "inventory_location_balances" ("location_id", "product_id", "quantity_cases", "quantity_bottles")
SELECT l.id, i.product_id, i.quantity_paid, i.loose_bottle_paid
FROM "inventory" i
JOIN "inventory_locations" l ON l.name = 'Warehouse - Landover'
ON CONFLICT ("location_id", "product_id") DO NOTHING;

INSERT INTO "inventory_location_balances" ("location_id", "product_id", "quantity_cases", "quantity_bottles")
SELECT l.id, p.id, 0, 0
FROM "inventory_locations" l CROSS JOIN "products" p
ON CONFLICT ("location_id", "product_id") DO NOTHING;

