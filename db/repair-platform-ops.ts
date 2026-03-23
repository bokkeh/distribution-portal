/**
 * repair-platform-ops.ts
 *
 * ONE-TIME repair script. DO NOT run this routinely.
 *
 * Background: Migration 0021_platform_ops.sql creates activity_events,
 * sms_threads, and reply_templates, and adds media_urls to sms_messages.
 * On certain environments the migration applied to Drizzle's history but the
 * DDL didn't fully execute. This script re-applies those statements safely
 * using IF NOT EXISTS / ADD COLUMN IF NOT EXISTS so it can be run without
 * risk of data loss.
 *
 * When to run:
 *   - A fresh environment reports missing tables for inbox, activity, or
 *     reply templates after `npm run db:push` completes without error.
 *   - You see "relation does not exist" errors referencing these tables.
 *
 * Run with: npx tsx db/repair-platform-ops.ts
 */
import { sql } from 'drizzle-orm'
import { db } from './index'

async function run() {
  await db.execute(sql`
    ALTER TABLE "sms_messages"
    ADD COLUMN IF NOT EXISTS "media_urls" text[];
  `)

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "activity_events" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "entity_type" text NOT NULL,
      "entity_id" uuid NOT NULL,
      "actor_user_id" uuid REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action,
      "related_user_id" uuid REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action,
      "kind" text NOT NULL,
      "title" text NOT NULL,
      "body" text,
      "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL
    );
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "activity_events_entity_idx"
    ON "activity_events" ("entity_type", "entity_id");
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "activity_events_created_at_idx"
    ON "activity_events" ("created_at");
  `)

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "sms_threads" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "phone_number" text NOT NULL UNIQUE,
      "customer_id" uuid REFERENCES "public"."customer_accounts"("id") ON DELETE set null ON UPDATE no action,
      "assigned_user_id" uuid REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action,
      "status" text DEFAULT 'open' NOT NULL,
      "priority" text DEFAULT 'normal' NOT NULL,
      "muted_until" timestamp with time zone,
      "last_message_at" timestamp with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    );
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "sms_threads_customer_id_idx"
    ON "sms_threads" ("customer_id");
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "sms_threads_assigned_user_id_idx"
    ON "sms_threads" ("assigned_user_id");
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "sms_threads_last_message_at_idx"
    ON "sms_threads" ("last_message_at");
  `)

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "reply_templates" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "title" text NOT NULL,
      "category" text DEFAULT 'general' NOT NULL,
      "body" text NOT NULL,
      "created_by_user_id" uuid REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    );
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "reply_templates_category_idx"
    ON "reply_templates" ("category");
  `)

  console.log('Platform ops schema repair completed.')
}

run().catch((error) => {
  console.error('Platform ops schema repair failed:', error)
  process.exit(1)
})
