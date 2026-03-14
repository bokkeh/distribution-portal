CREATE TABLE IF NOT EXISTS "tastings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "customer_id" uuid NOT NULL REFERENCES "public"."customer_accounts"("id") ON DELETE cascade ON UPDATE no action,
  "assigned_user_id" uuid NOT NULL REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action,
  "created_by_user_id" uuid NOT NULL REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action,
  "event_name" text NOT NULL,
  "scheduled_at" timestamp with time zone NOT NULL,
  "status" text DEFAULT 'scheduled' NOT NULL,
  "store_address" text,
  "store_city" text,
  "store_state" text,
  "store_zip" text,
  "store_phone" text,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
