ALTER TABLE "account_notes" ADD COLUMN "occurred_at" timestamp with time zone;

UPDATE "account_notes"
SET "occurred_at" = "created_at"
WHERE "occurred_at" IS NULL;

ALTER TABLE "account_notes" ALTER COLUMN "occurred_at" SET DEFAULT now();
ALTER TABLE "account_notes" ALTER COLUMN "occurred_at" SET NOT NULL;

CREATE INDEX "account_notes_account_occurred_idx" ON "account_notes" ("account_id", "occurred_at");
