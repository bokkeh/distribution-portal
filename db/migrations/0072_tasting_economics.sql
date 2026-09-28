-- Tasting objective, goal, targets and cost on each tasting.
ALTER TABLE "tastings"
  ADD COLUMN IF NOT EXISTS "objective" text,
  ADD COLUMN IF NOT EXISTS "primary_goal" text,
  ADD COLUMN IF NOT EXISTS "target_bottles_sold" integer,
  ADD COLUMN IF NOT EXISTS "target_cases_depleted" numeric(10, 2),
  ADD COLUMN IF NOT EXISTS "target_reorder_quantity" integer,
  ADD COLUMN IF NOT EXISTS "estimated_cost" numeric(10, 2),
  ADD COLUMN IF NOT EXISTS "taster_pay" numeric(10, 2),
  ADD COLUMN IF NOT EXISTS "expected_roi" text,
  ADD COLUMN IF NOT EXISTS "strategic_reason" text,
  ADD COLUMN IF NOT EXISTS "expected_outcome" text,
  ADD COLUMN IF NOT EXISTS "estimated_value" numeric(12, 2),
  ADD COLUMN IF NOT EXISTS "follow_up_action" text,
  ADD COLUMN IF NOT EXISTS "result_after_event" text,
  ADD COLUMN IF NOT EXISTS "decision_at_scheduling" text,
  ADD COLUMN IF NOT EXISTS "decision_acknowledged_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE "tastings"
  DROP CONSTRAINT IF EXISTS "tastings_objective_check";
--> statement-breakpoint
ALTER TABLE "tastings"
  ADD CONSTRAINT "tastings_objective_check"
  CHECK ("objective" IS NULL OR "objective" IN ('sell_through', 'reorder', 'account_opening', 'strategic'));
--> statement-breakpoint
ALTER TABLE "tastings"
  DROP CONSTRAINT IF EXISTS "tastings_decision_at_scheduling_check";
--> statement-breakpoint
ALTER TABLE "tastings"
  ADD CONSTRAINT "tastings_decision_at_scheduling_check"
  CHECK ("decision_at_scheduling" IS NULL OR "decision_at_scheduling" IN ('recommended', 'consider', 'not_recommended'));
--> statement-breakpoint

-- Global, editable economics assumptions (single row).
CREATE TABLE IF NOT EXISTS "tasting_economics_settings" (
  "id" text PRIMARY KEY DEFAULT 'global' NOT NULL,
  "contribution_per_case" numeric(10, 2) DEFAULT '75' NOT NULL,
  "default_tasting_cost" numeric(10, 2) DEFAULT '90' NOT NULL,
  "attribution_window_days" integer DEFAULT 14 NOT NULL,
  "assisted_sales_share" numeric(4, 2) DEFAULT '0.5' NOT NULL,
  "updated_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
INSERT INTO "tasting_economics_settings" ("id") VALUES ('global') ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint

-- Admin override of an order's organic / tasting-assisted classification.
ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "tasting_attribution_override" text,
  ADD COLUMN IF NOT EXISTS "tasting_attribution_override_reason" text,
  ADD COLUMN IF NOT EXISTS "tasting_attribution_override_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "tasting_attribution_override_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "orders"
  DROP CONSTRAINT IF EXISTS "orders_tasting_attribution_override_check";
--> statement-breakpoint
ALTER TABLE "orders"
  ADD CONSTRAINT "orders_tasting_attribution_override_check"
  CHECK ("tasting_attribution_override" IS NULL OR "tasting_attribution_override" IN ('organic', 'assisted'));
--> statement-breakpoint

-- Admin override of an account's health classification.
ALTER TABLE "customer_accounts"
  ADD COLUMN IF NOT EXISTS "health_override" text,
  ADD COLUMN IF NOT EXISTS "health_override_reason" text,
  ADD COLUMN IF NOT EXISTS "health_override_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "health_override_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "customer_accounts"
  DROP CONSTRAINT IF EXISTS "customer_accounts_health_override_check";
--> statement-breakpoint
ALTER TABLE "customer_accounts"
  ADD CONSTRAINT "customer_accounts_health_override_check"
  CHECK ("health_override" IS NULL OR "health_override" IN ('growth', 'healthy', 'developing', 'tasting_dependent', 'stalled', 'unprofitable'));
