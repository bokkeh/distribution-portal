ALTER TABLE "invoices"
ADD COLUMN IF NOT EXISTS "waive_ach_fee" boolean DEFAULT false NOT NULL;
