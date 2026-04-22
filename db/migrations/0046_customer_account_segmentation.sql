ALTER TABLE "customer_accounts" ADD COLUMN "customer_segment" text DEFAULT 'b2b_wholesale' NOT NULL;
--> statement-breakpoint
ALTER TABLE "customer_accounts" ADD COLUMN "customer_source" text;
--> statement-breakpoint
ALTER TABLE "customer_accounts" ADD COLUMN "source_external_id" text;
