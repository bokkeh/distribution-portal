ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "delivery_date" date;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "order_documents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "order_id" uuid NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
  "file_name" text NOT NULL,
  "storage_path" text NOT NULL,
  "content_type" text NOT NULL,
  "uploaded_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "uploaded_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_documents_order_idx" ON "order_documents" ("order_id");
