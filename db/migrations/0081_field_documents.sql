CREATE TABLE IF NOT EXISTS field_documents (
  id uuid PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES customer_accounts(id),
  created_by_user_id uuid NOT NULL REFERENCES users(id),
  kind text NOT NULL,
  fingerprint text NOT NULL,
  order_id uuid REFERENCES orders(id),
  invoice_id uuid NOT NULL REFERENCES invoices(id),
  payment_method text NOT NULL,
  recipient_email text NOT NULL,
  email_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS field_documents_account_idx ON field_documents(account_id, created_at);
