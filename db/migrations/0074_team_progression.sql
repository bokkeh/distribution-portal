CREATE TABLE IF NOT EXISTS "progression_rank_requirements" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "level" integer NOT NULL,
  "market" text,
  "key" text NOT NULL,
  "label" text NOT NULL,
  "requirement_type" text NOT NULL DEFAULT 'required',
  "target_numeric" numeric(12, 2),
  "is_qualitative" boolean NOT NULL DEFAULT false,
  "notes" text,
  "sort_order" integer NOT NULL DEFAULT 0,
  "updated_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "progression_rank_requirements_scope_key" UNIQUE ("level", "market", "key")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "progression_rank_requirements_level_idx" ON "progression_rank_requirements" ("level");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "progression_rank_assignments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "level" integer NOT NULL,
  "previous_level" integer,
  "change_type" text NOT NULL DEFAULT 'promotion',
  "is_temporary" boolean NOT NULL DEFAULT false,
  "temporary_until" timestamptz,
  "reason" text NOT NULL,
  "notes" text,
  "overridden_requirements" jsonb DEFAULT '[]',
  "assigned_by_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE SET NULL,
  "effective_at" timestamptz DEFAULT now() NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "progression_rank_assignments_user_idx" ON "progression_rank_assignments" ("user_id", "effective_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "progression_starter_kit_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "label" text NOT NULL,
  "description" text,
  "tracks_expiry" boolean NOT NULL DEFAULT false,
  "sort_order" integer NOT NULL DEFAULT 0,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "progression_starter_kit_completions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "item_id" uuid NOT NULL REFERENCES "progression_starter_kit_items"("id") ON DELETE CASCADE,
  "completed_at" timestamptz,
  "completed_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "expires_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "progression_starter_kit_completions_user_item" UNIQUE ("user_id", "item_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "progression_requirement_completions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "level" integer NOT NULL,
  "requirement_key" text NOT NULL,
  "status" text NOT NULL DEFAULT 'complete',
  "reason" text,
  "marked_by_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "progression_requirement_completions_user_idx" ON "progression_requirement_completions" ("user_id", "level");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "progression_promotion_recommendations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "from_level" integer NOT NULL,
  "to_level" integer NOT NULL,
  "status" text NOT NULL DEFAULT 'recommended',
  "recommended_by_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE SET NULL,
  "recommended_reason" text,
  "decided_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "decided_at" timestamptz,
  "decision_notes" text,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "progression_promotion_recommendations_user_idx" ON "progression_promotion_recommendations" ("user_id", "status");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "progression_training_records" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "trainer_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "trainee_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "topic" text NOT NULL,
  "session_date" timestamptz NOT NULL,
  "notes" text,
  "recorded_by_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "progression_training_records_trainer_idx" ON "progression_training_records" ("trainer_user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "progression_training_records_trainee_idx" ON "progression_training_records" ("trainee_user_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "progression_reviews" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "scheduled_for" timestamptz NOT NULL,
  "requested_by_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE SET NULL,
  "reason" text,
  "status" text NOT NULL DEFAULT 'scheduled',
  "completed_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "completed_at" timestamptz,
  "outcome_notes" text,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "progression_reviews_user_idx" ON "progression_reviews" ("user_id", "status");
