ALTER TABLE "tastings" ADD COLUMN IF NOT EXISTS "cancellation_reason" text;
--> statement-breakpoint
ALTER TABLE "tastings" ADD COLUMN IF NOT EXISTS "cancellation_note" text;
