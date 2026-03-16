ALTER TABLE "user_preferences"
ADD COLUMN IF NOT EXISTS "taster_onboarding_completed_at" timestamp with time zone;

ALTER TABLE "user_preferences"
ADD COLUMN IF NOT EXISTS "driver_onboarding_completed_at" timestamp with time zone;
