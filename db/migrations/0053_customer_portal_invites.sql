CREATE TABLE "customer_portal_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"email" text NOT NULL,
	"token_hash" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"invited_by_user_id" uuid NOT NULL,
	"accepted_user_id" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_portal_invites_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "customer_portal_invites" ADD CONSTRAINT "customer_portal_invites_request_id_wholesale_account_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."wholesale_account_requests"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "customer_portal_invites" ADD CONSTRAINT "customer_portal_invites_account_id_customer_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."customer_accounts"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "customer_portal_invites" ADD CONSTRAINT "customer_portal_invites_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "customer_portal_invites" ADD CONSTRAINT "customer_portal_invites_accepted_user_id_users_id_fk" FOREIGN KEY ("accepted_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "customer_portal_invites_email_idx" ON "customer_portal_invites" USING btree ("email");
--> statement-breakpoint
CREATE INDEX "customer_portal_invites_account_idx" ON "customer_portal_invites" USING btree ("account_id");
--> statement-breakpoint
CREATE INDEX "customer_portal_invites_status_idx" ON "customer_portal_invites" USING btree ("status");
