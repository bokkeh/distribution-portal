CREATE TABLE IF NOT EXISTS "tasting_report_photo_drafts" (
  "tasting_id" uuid PRIMARY KEY NOT NULL REFERENCES "tastings"("id") ON DELETE CASCADE,
  "saved_by_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "setup_photo_url" text,
  "shelf_photo_urls" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
