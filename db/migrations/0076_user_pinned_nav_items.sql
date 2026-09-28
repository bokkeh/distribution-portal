CREATE TABLE IF NOT EXISTS "user_pinned_nav_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "nav_key" text NOT NULL,
  "sort_order" integer NOT NULL DEFAULT 0,
  "pinned_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "user_pinned_nav_items_user_nav_key_unique" UNIQUE ("user_id", "nav_key")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_pinned_nav_items_user_id_idx" ON "user_pinned_nav_items" ("user_id");
