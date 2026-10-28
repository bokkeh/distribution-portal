CREATE TABLE IF NOT EXISTS account_onboarding (
 account_id uuid PRIMARY KEY REFERENCES customer_accounts(id) ON DELETE CASCADE,
 referral_contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
 referring_account_id uuid REFERENCES customer_accounts(id) ON DELETE SET NULL,
 requested_terms text, status text NOT NULL DEFAULT 'new', whatsapp_phone text,
 whatsapp_status text NOT NULL DEFAULT 'not_started', notes text,
 revision integer NOT NULL DEFAULT 1, updated_at timestamptz NOT NULL DEFAULT now()
);
