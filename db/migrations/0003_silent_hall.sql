CREATE TABLE "sms_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone_normalized" text NOT NULL,
	"status" text DEFAULT 'subscribed' NOT NULL,
	"source" text DEFAULT 'system' NOT NULL,
	"consent_language" text,
	"last_keyword" text,
	"opted_in_at" timestamp with time zone,
	"opted_out_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sms_subscriptions_phone_normalized_unique" UNIQUE("phone_normalized")
);
