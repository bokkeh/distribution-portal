CREATE TABLE IF NOT EXISTS "taster_invoices" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tasting_id" uuid NOT NULL UNIQUE REFERENCES "public"."tastings"("id") ON DELETE cascade ON UPDATE no action,
  "submitted_by_user_id" uuid NOT NULL REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action,
  "payee_name" text NOT NULL,
  "payee_email" text NOT NULL,
  "payee_phone" text,
  "hourly_rate" numeric(10,2) DEFAULT '0' NOT NULL,
  "hours_worked" numeric(10,2) DEFAULT '0' NOT NULL,
  "mileage" numeric(10,2) DEFAULT '0' NOT NULL,
  "expense_amount" numeric(10,2) DEFAULT '0' NOT NULL,
  "total_amount" numeric(10,2) DEFAULT '0' NOT NULL,
  "notes" text,
  "status" text DEFAULT 'submitted' NOT NULL,
  "submitted_at" timestamp with time zone DEFAULT now() NOT NULL
);
