ALTER TABLE community_recipe_emails ADD COLUMN IF NOT EXISTS bounce_count integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE community_recipe_emails ADD COLUMN IF NOT EXISTS complaint_count integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE community_recipe_emails ADD COLUMN IF NOT EXISTS unsubscribe_count integer NOT NULL DEFAULT 0;
