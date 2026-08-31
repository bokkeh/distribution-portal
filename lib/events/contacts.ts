import 'server-only'
import { eq, or, sql } from 'drizzle-orm'
import { db } from '@/db'
import { communityContacts } from '@/db/schema'
import { normalizePhone } from '@/lib/telnyx/compliance'

type EventContactSource = 'event_rsvp' | 'event_manual' | 'event_import'

function safeNormalizePhone(value: string) {
  try {
    return normalizePhone(value)
  } catch {
    return value.trim()
  }
}

export async function findOrCreateEventContact(input: {
  firstName: string
  lastName: string
  email: string
  phone: string
  source: EventContactSource
  marketingConsent: boolean
  smsConsent: boolean
  createdByUserId?: string | null
}) {
  const email = input.email.trim().toLowerCase()
  const phone = safeNormalizePhone(input.phone)
  const phoneDigits = phone.replace(/\D/g, '')

  const [existing] = await db
    .select()
    .from(communityContacts)
    .where(or(
      sql`lower(${communityContacts.email}) = ${email}`,
      sql`regexp_replace(${communityContacts.phone}, '[^0-9]', '', 'g') = ${phoneDigits}`,
    ))
    .limit(1)

  if (existing) {
    const updates: Partial<typeof communityContacts.$inferInsert> = { updatedAt: new Date() }
    if (input.marketingConsent && existing.status !== 'subscribed') {
      updates.status = 'subscribed'
      updates.marketingConsentAt = new Date()
    }
    if (input.smsConsent && !existing.smsConsentAt) updates.smsConsentAt = new Date()
    await db.update(communityContacts).set(updates).where(eq(communityContacts.id, existing.id))
    return { ...existing, ...updates, isNew: false }
  }

  const [created] = await db.insert(communityContacts).values({
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    email,
    phone,
    status: input.marketingConsent ? 'subscribed' : 'unsubscribed',
    source: input.source,
    marketingConsentAt: new Date(),
    smsConsentAt: input.smsConsent ? new Date() : null,
    createdByUserId: input.createdByUserId ?? null,
  }).returning()

  return { ...created, isNew: true }
}
