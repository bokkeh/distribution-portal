CREATE INDEX CONCURRENTLY IF NOT EXISTS "customer_accounts_user_id_idx"
  ON "customer_accounts" ("user_id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "customer_accounts_hubspot_company_id_idx"
  ON "customer_accounts" ("hubspot_company_id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "customer_accounts_assigned_sales_rep_id_idx"
  ON "customer_accounts" ("assigned_sales_rep_id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "customer_accounts_assigned_region_id_idx"
  ON "customer_accounts" ("assigned_region_id");
