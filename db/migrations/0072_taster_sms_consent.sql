CREATE TABLE IF NOT EXISTS taster_sms_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  phone_normalized text NOT NULL,
  granted boolean NOT NULL,
  age_21_confirmed boolean NOT NULL,
  consent_language text NOT NULL,
  consent_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS taster_sms_consents_lookup ON taster_sms_consents(user_id, phone_normalized, created_at DESC);
