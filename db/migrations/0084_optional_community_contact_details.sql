-- Missing email addresses must not conflict or cause unrelated members to merge.
DROP INDEX IF EXISTS community_contacts_email_uidx;
--> statement-breakpoint
CREATE UNIQUE INDEX community_contacts_email_uidx ON community_contacts (email) WHERE email <> '';
