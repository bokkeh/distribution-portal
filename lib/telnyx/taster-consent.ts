import 'server-only'
import { sql } from 'drizzle-orm'
import { db } from '@/db'
import { getSmsSubscription, normalizePhone } from './compliance'
import { AGE_GATE_VERSION } from './age-gate'

export const TASTER_SMS_CONSENT_VERSION = '2026-10-06-birthdate'
export const TASTER_SMS_CONSENT_COPY = 'I agree to receive SMS from AHAWC LLC about tasting assignments, confirmations, schedule changes, reminders, event prompts and availability. Message frequency varies. Message and data rates may apply. Reply STOP to opt out or HELP for help, or email admin@ahawc.com. Consent is optional and is not a condition of purchase or accepting assignments. Mobile information will not be sold or shared with third parties for promotional or marketing purposes.'

export async function hasTasterSmsConsent(userId: string, phone: string) {
  const normalized = normalizePhone(phone)
  const rows = await db.execute(sql`SELECT granted, age_21_confirmed, age_gate_version FROM taster_sms_consents WHERE user_id = ${userId} AND phone_normalized = ${normalized} ORDER BY created_at DESC, id DESC LIMIT 1`)
  const subscription = await getSmsSubscription(normalized)
  return rows.rows[0]?.granted === true && rows.rows[0]?.age_21_confirmed === true && rows.rows[0]?.age_gate_version === AGE_GATE_VERSION && subscription?.status !== 'unsubscribed'
}

export async function requireTasterConsentForPhone(phone: string) {
  const normalized = normalizePhone(phone)
  const digits = normalized.replace(/\D/g, '')
  const rows = await db.execute(sql`SELECT id FROM users WHERE (role = 'taster' OR 'taster' = ANY(roles)) AND right(regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g'), 10) = right(${digits}, 10)`)
  for (const row of rows.rows) {
    if (!await hasTasterSmsConsent(String(row.id), normalized)) throw new Error('Taster SMS consent is required; complete SMS consent in My Profile')
  }
}
