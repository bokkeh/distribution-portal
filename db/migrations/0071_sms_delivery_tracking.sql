ALTER TABLE "sms_messages" ADD COLUMN IF NOT EXISTS "delivery_error" text;
ALTER TABLE "scheduled_sms_jobs" ADD COLUMN IF NOT EXISTS "provider_message_id" text;
ALTER TABLE "notifications_log" ADD COLUMN IF NOT EXISTS "provider_message_id" text;
