ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "account_status" text NOT NULL DEFAULT 'active';
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "affiliated_company_name" text;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "taster_invites" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "token_hash" text NOT NULL UNIQUE,
  "status" text NOT NULL DEFAULT 'pending',
  "created_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "expires_at" timestamptz NOT NULL,
  "accepted_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "taster_invites_user_id_idx" ON "taster_invites" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "taster_invites_status_idx" ON "taster_invites" ("status");
