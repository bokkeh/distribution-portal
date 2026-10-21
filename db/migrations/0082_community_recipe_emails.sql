CREATE TABLE IF NOT EXISTS community_recipe_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_key text NOT NULL,
  recipe_handle text NOT NULL,
  recipe_title text NOT NULL,
  recipe_url text NOT NULL,
  subject text NOT NULL,
  status text NOT NULL DEFAULT 'sending',
  recipient_count integer NOT NULL DEFAULT 0,
  sent_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS community_recipe_emails_week_uidx ON community_recipe_emails(week_key);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS community_recipe_emails_created_idx ON community_recipe_emails(created_at);
