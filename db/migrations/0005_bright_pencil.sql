CREATE TABLE "inventory_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"actor_user_id" uuid,
	"order_id" uuid,
	"type" text NOT NULL,
	"reason" text,
	"delta_paid" integer DEFAULT 0 NOT NULL,
	"delta_sample" integer DEFAULT 0 NOT NULL,
	"delta_loose_bottle_paid" integer DEFAULT 0 NOT NULL,
	"quantity_paid_after" integer DEFAULT 0 NOT NULL,
	"quantity_sample_after" integer DEFAULT 0 NOT NULL,
	"loose_bottle_paid_after" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
