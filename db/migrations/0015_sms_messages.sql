CREATE TABLE IF NOT EXISTS "sms_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action,
  "direction" text NOT NULL,
  "phone_number" text NOT NULL,
  "contact_name" text,
  "body" text NOT NULL,
  "status" text NOT NULL,
  "provider_message_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
