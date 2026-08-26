CREATE TABLE IF NOT EXISTS "community_contacts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "first_name" text NOT NULL,
  "last_name" text NOT NULL,
  "email" text NOT NULL,
  "phone" text NOT NULL,
  "status" text DEFAULT 'subscribed' NOT NULL CHECK ("status" IN ('subscribed', 'unsubscribed')),
  "source" text NOT NULL CHECK ("source" IN ('public_signup', 'admin_entry', 'import')),
  "marketing_consent_at" timestamptz DEFAULT now() NOT NULL,
  "created_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "community_contacts_email_uidx" ON "community_contacts" ("email");
CREATE INDEX IF NOT EXISTS "community_contacts_status_idx" ON "community_contacts" ("status");
CREATE INDEX IF NOT EXISTS "community_contacts_created_at_idx" ON "community_contacts" ("created_at");
