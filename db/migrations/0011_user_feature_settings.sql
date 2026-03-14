CREATE TABLE IF NOT EXISTS "user_feature_settings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL UNIQUE REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action,
  "features" text[] DEFAULT ARRAY[]::text[] NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
