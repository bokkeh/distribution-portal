CREATE TABLE IF NOT EXISTS "dashboard_overhead_targets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "month_key" text NOT NULL UNIQUE,
  "amount" numeric(12, 2) NOT NULL,
  "updated_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
