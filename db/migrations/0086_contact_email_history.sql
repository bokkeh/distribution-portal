CREATE TABLE IF NOT EXISTS contact_emails (
 id uuid PRIMARY KEY, contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
 account_id uuid REFERENCES customer_accounts(id) ON DELETE SET NULL,
 actor_user_id uuid NOT NULL REFERENCES users(id), sender text NOT NULL, reply_to text,
 recipient text NOT NULL, subject text NOT NULL, body text NOT NULL,
 status text NOT NULL DEFAULT 'queued', provider_message_id text, error text,
 created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS contact_emails_contact_idx ON contact_emails(contact_id, created_at);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS contact_emails_account_idx ON contact_emails(account_id, created_at);
--> statement-breakpoint
ALTER TABLE contact_emails ADD COLUMN IF NOT EXISTS delivery_events jsonb NOT NULL DEFAULT '[]'::jsonb;
