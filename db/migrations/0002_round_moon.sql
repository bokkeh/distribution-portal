CREATE TABLE "wholesale_account_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_name" text NOT NULL,
	"business_email" text NOT NULL,
	"phone" text NOT NULL,
	"phone_normalized" text NOT NULL,
	"sms_opt_in" boolean DEFAULT false NOT NULL,
	"sms_opt_in_at" timestamp with time zone,
	"sms_consent_language" text,
	"source" text DEFAULT 'marketing_contact_form' NOT NULL,
	"submission_page" text,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
