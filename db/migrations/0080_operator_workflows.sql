-- Historical assignments, dates, relationships and classifications are retained.
ALTER TABLE tastings ALTER COLUMN assigned_user_id DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE tastings DROP CONSTRAINT IF EXISTS tastings_assigned_user_id_users_id_fk;
--> statement-breakpoint
ALTER TABLE tastings DROP CONSTRAINT IF EXISTS tastings_assigned_user_id_fkey;
--> statement-breakpoint
ALTER TABLE tastings ADD CONSTRAINT tastings_assigned_user_id_users_id_fk FOREIGN KEY (assigned_user_id) REFERENCES users(id) ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE tastings ADD COLUMN IF NOT EXISTS time_zone text NOT NULL DEFAULT 'America/New_York';
--> statement-breakpoint
ALTER TABLE tastings ADD COLUMN IF NOT EXISTS scheduling_fingerprint text;
--> statement-breakpoint
ALTER TABLE customer_accounts ADD COLUMN IF NOT EXISTS scheduling_venue_key text UNIQUE;
--> statement-breakpoint
ALTER TABLE contacts ALTER COLUMN customer_id DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE contacts DROP CONSTRAINT IF EXISTS contacts_customer_id_customer_accounts_id_fk;
--> statement-breakpoint
ALTER TABLE contacts ADD CONSTRAINT contacts_customer_id_customer_accounts_id_fk FOREIGN KEY (customer_id) REFERENCES customer_accounts(id) ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS relationship_status text;
--> statement-breakpoint
ALTER TABLE account_price_history ADD COLUMN IF NOT EXISTS observed_at timestamptz;
--> statement-breakpoint
ALTER TABLE account_price_history ADD COLUMN IF NOT EXISTS time_zone text NOT NULL DEFAULT 'America/New_York';
--> statement-breakpoint
ALTER TABLE account_price_history ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'USD';
--> statement-breakpoint
ALTER TABLE account_price_history ADD COLUMN IF NOT EXISTS price_type text NOT NULL DEFAULT 'unspecified';
--> statement-breakpoint
ALTER TABLE account_price_history ADD COLUMN IF NOT EXISTS product_size text;
-- observed_at remains null for legacy date-only observations; no times are invented.
