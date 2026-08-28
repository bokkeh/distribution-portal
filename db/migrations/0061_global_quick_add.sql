CREATE TABLE IF NOT EXISTS "tasting_products" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tasting_id" uuid NOT NULL REFERENCES "tastings"("id") ON DELETE CASCADE,
  "product_id" uuid NOT NULL REFERENCES "products"("id"),
  "planned_quantity" numeric(10, 2) DEFAULT '0' NOT NULL,
  "starting_inventory" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "units_sold" integer DEFAULT 0 NOT NULL,
  "revenue_generated" numeric(12, 2) DEFAULT '0' NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "tasting_products_tasting_idx" ON "tasting_products" ("tasting_id");
CREATE INDEX IF NOT EXISTS "tasting_products_product_idx" ON "tasting_products" ("product_id");

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "is_assisted" boolean DEFAULT false NOT NULL;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "assisted_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "assistance_type" text;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "related_tasting_id" uuid REFERENCES "tastings"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "orders_related_tasting_idx" ON "orders" ("related_tasting_id");
CREATE INDEX IF NOT EXISTS "orders_assisted_by_idx" ON "orders" ("assisted_by_user_id", "created_at");

ALTER TABLE "delivery_stops" ADD COLUMN IF NOT EXISTS "scheduled_at" timestamptz;
ALTER TABLE "delivery_stops" ADD COLUMN IF NOT EXISTS "assigned_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL;
ALTER TABLE "delivery_stops" ADD COLUMN IF NOT EXISTS "recipient_contact_id" uuid REFERENCES "contacts"("id") ON DELETE SET NULL;
ALTER TABLE "delivery_stops" ADD COLUMN IF NOT EXISTS "delivered_items" jsonb DEFAULT '[]'::jsonb NOT NULL;
CREATE INDEX IF NOT EXISTS "delivery_stops_scheduled_idx" ON "delivery_stops" ("scheduled_at", "status");

CREATE TABLE IF NOT EXISTS "crm_tasks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "account_id" uuid REFERENCES "customer_accounts"("id") ON DELETE CASCADE,
  "contact_id" uuid REFERENCES "contacts"("id") ON DELETE SET NULL,
  "order_id" uuid REFERENCES "orders"("id") ON DELETE SET NULL,
  "delivery_id" uuid REFERENCES "deliveries"("id") ON DELETE SET NULL,
  "tasting_id" uuid REFERENCES "tastings"("id") ON DELETE SET NULL,
  "created_by_user_id" uuid NOT NULL REFERENCES "users"("id"),
  "assigned_to_user_id" uuid NOT NULL REFERENCES "users"("id"),
  "due_at" timestamptz NOT NULL,
  "priority" text DEFAULT 'normal' NOT NULL CHECK ("priority" IN ('low', 'normal', 'high', 'urgent')),
  "status" text DEFAULT 'open' NOT NULL CHECK ("status" IN ('open', 'in_progress', 'completed', 'cancelled')),
  "reminder_offset_minutes" integer,
  "notification_channels" text[] DEFAULT ARRAY['in-app']::text[] NOT NULL,
  "reminder_sent_at" timestamptz,
  "overdue_notified_at" timestamptz,
  "completed_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "crm_tasks_reminder_offset_check" CHECK ("reminder_offset_minutes" IS NULL OR "reminder_offset_minutes" >= 0)
);

CREATE INDEX IF NOT EXISTS "crm_tasks_account_idx" ON "crm_tasks" ("account_id", "due_at");
CREATE INDEX IF NOT EXISTS "crm_tasks_assignee_due_idx" ON "crm_tasks" ("assigned_to_user_id", "due_at");
CREATE INDEX IF NOT EXISTS "crm_tasks_status_due_idx" ON "crm_tasks" ("status", "due_at");
CREATE INDEX IF NOT EXISTS "crm_tasks_tasting_idx" ON "crm_tasks" ("tasting_id");
