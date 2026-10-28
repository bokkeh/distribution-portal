'use server'
import { db } from '@/db'
import { sql } from 'drizzle-orm'
import { requireAdminOrStaff, requireRole } from '@/lib/auth/session'
import { z } from 'zod'
import { PAYMENT_TERM_OPTIONS } from '@/lib/orders/payment-terms'
import { revalidatePath } from 'next/cache'

const nullableId = z.union([z.literal(''), z.uuid()]).transform(value => value || null)
const onboardingInput = z.object({
  accountId: z.uuid(), revision: z.coerce.number().int().min(0), referralContactId: nullableId,
  referringAccountId: nullableId, requestedTerms: z.string().trim().max(100),
  status: z.enum(['new', 'collecting_details', 'pending_terms', 'ready', 'on_hold']),
  whatsappPhone: z.union([z.literal(''), z.string().regex(/^\+[1-9]\d{7,14}$/)]),
  whatsappStatus: z.enum(['not_started', 'follow_up_needed', 'contact_link_ready', 'completed']), notes: z.string().max(10000),
})
export async function saveAccountOnboarding(_state: { error?: string; success?: boolean }, form: FormData): Promise<{ error?: string; success?: boolean }> {
  try {
    const session = await requireAdminOrStaff()
    const v = onboardingInput.parse(Object.fromEntries(form))
    if (v.referringAccountId === v.accountId) return { error: 'An account cannot refer itself.' }
    const result = await db.execute(sql`WITH saved AS (
      INSERT INTO account_onboarding (account_id, referral_contact_id, referring_account_id, requested_terms, status, whatsapp_phone, whatsapp_status, notes)
      SELECT ${v.accountId}::uuid, ${v.referralContactId}::uuid, ${v.referringAccountId}::uuid, ${v.requestedTerms || null}, ${v.status}, ${v.whatsappPhone || null}, ${v.whatsappStatus}, ${v.notes || null}
      WHERE ${v.revision} = 0
      ON CONFLICT (account_id) DO NOTHING RETURNING account_id
    ), updated AS (
      UPDATE account_onboarding SET referral_contact_id = ${v.referralContactId}::uuid, referring_account_id = ${v.referringAccountId}::uuid,
        requested_terms = ${v.requestedTerms || null}, status = ${v.status}, whatsapp_phone = ${v.whatsappPhone || null}, whatsapp_status = ${v.whatsappStatus}, notes = ${v.notes || null}, revision = revision + 1, updated_at = now()
      WHERE account_id = ${v.accountId}::uuid AND revision = ${v.revision} AND ${v.revision} > 0 RETURNING account_id
    ) INSERT INTO activity_events (entity_type, entity_id, actor_user_id, kind, title, metadata)
      SELECT 'account', account_id, ${session.user.id}::uuid, 'account_onboarding_saved', 'Account onboarding updated', ${JSON.stringify(v)}::jsonb FROM (SELECT account_id FROM saved UNION ALL SELECT account_id FROM updated) changed RETURNING entity_id`)
    if (!result.rows.length) return { error: 'Onboarding changed elsewhere. Reload and review before saving.' }
    for (const mode of ['admin', 'staff']) revalidatePath(`/${mode}/crm/${v.accountId}`)
    return { success: true }
  } catch (error) { return { error: error instanceof z.ZodError ? 'Check the form values. WhatsApp phone must use international format, e.g. +12025550123.' : error instanceof Error ? error.message : 'Failed to save onboarding.' } }
}
export async function approveAccountTerms(_state: { error?: string; success?: boolean }, form: FormData): Promise<{ error?: string; success?: boolean }> {
  try {
    const session = await requireRole('admin')
    const v = z.object({ accountId: z.uuid(), terms: z.string().refine(value => PAYMENT_TERM_OPTIONS.some(option => option.value === value)), previousTerms: z.string(), reason: z.string().trim().min(3).max(2000) }).parse(Object.fromEntries(form))
    const result = await db.execute(sql`WITH changed AS (
      UPDATE customer_accounts SET payment_terms = ${v.terms} WHERE id = ${v.accountId}::uuid AND coalesce(payment_terms, '') = ${v.previousTerms} RETURNING id
    ) INSERT INTO activity_events (entity_type, entity_id, actor_user_id, kind, title, body, metadata)
      SELECT 'account', id, ${session.user.id}::uuid, 'payment_terms_approved', 'Payment terms approved', ${v.reason}, ${JSON.stringify({ previous: v.previousTerms, approved: v.terms })}::jsonb FROM changed RETURNING entity_id`)
    if (!result.rows.length) return { error: 'Terms changed elsewhere. Reload to review.' }
    for (const mode of ['admin', 'staff']) revalidatePath(`/${mode}/crm/${v.accountId}`)
    return { success: true }
  } catch { return { error: 'Could not approve terms. Admin access and an approval reason are required.' } }
}
