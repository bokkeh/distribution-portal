ALTER TABLE taster_sms_consents ADD COLUMN IF NOT EXISTS age_gate_version text;
ALTER TABLE wholesale_account_requests ADD COLUMN IF NOT EXISTS age_gate_version text;
ALTER TABLE wholesale_account_requests ADD COLUMN IF NOT EXISTS age_verified_at timestamptz;
