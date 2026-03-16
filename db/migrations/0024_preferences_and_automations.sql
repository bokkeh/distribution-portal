CREATE TABLE IF NOT EXISTS "user_preferences" (
  "user_id" uuid PRIMARY KEY REFERENCES "users"("id") ON DELETE cascade,
  "time_zone" text DEFAULT 'America/New_York' NOT NULL,
  "notification_preference" text DEFAULT 'all' NOT NULL,
  "email_notifications_enabled" boolean DEFAULT true NOT NULL,
  "sms_notifications_enabled" boolean DEFAULT true NOT NULL,
  "in_app_notifications_enabled" boolean DEFAULT true NOT NULL,
  "quiet_hours_start" text,
  "quiet_hours_end" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "account_preferences" (
  "account_id" uuid PRIMARY KEY REFERENCES "customer_accounts"("id") ON DELETE cascade,
  "time_zone" text DEFAULT 'America/New_York' NOT NULL,
  "quiet_hours_start" text,
  "quiet_hours_end" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
