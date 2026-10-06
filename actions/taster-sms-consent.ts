'use server'

import { sql, eq } from 'drizzle-orm'
import { db } from '@/db'
import { users, userPreferences } from '@/db/schema'
import { requireAuth } from '@/lib/auth/session'
import { normalizePhone, setSmsSubscription } from '@/lib/telnyx/compliance'
import { TASTER_SMS_CONSENT_COPY, TASTER_SMS_CONSENT_VERSION } from '@/lib/telnyx/taster-consent'
import { revalidatePath } from 'next/cache'

export async function saveTasterSmsConsent(_previous: { error?: string; saved?: boolean } | null, form: FormData) {
  try {
    const session = await requireAuth()
    if (!(session.user.roles ?? [session.user.role]).includes('taster')) throw new Error('Taster access required')
    const [user] = await db.select({ phone: users.phone }).from(users).where(eq(users.id, session.user.id)).limit(1)
    if (!user?.phone) throw new Error('Save your phone number in your profile first')
    const phone = normalizePhone(user.phone)
    const granted = form.get('intent') === 'grant'
    if (granted && (form.get('smsConsent') !== 'on' || form.get('age21') !== 'on')) throw new Error('Check both SMS consent and the age confirmation to enable texts')
    await db.execute(sql`INSERT INTO taster_sms_consents (user_id, phone_normalized, granted, age_21_confirmed, consent_language, consent_version) VALUES (${session.user.id}, ${phone}, ${granted}, ${granted}, ${TASTER_SMS_CONSENT_COPY}, ${TASTER_SMS_CONSENT_VERSION})`)
    await setSmsSubscription({ phoneNormalized: phone, status: granted ? 'subscribed' : 'unsubscribed', source: 'authenticated_taster_profile', consentLanguage: TASTER_SMS_CONSENT_COPY })
    await db.insert(userPreferences).values({ userId: session.user.id, smsNotificationsEnabled: granted }).onConflictDoUpdate({ target: userPreferences.userId, set: { smsNotificationsEnabled: granted, updatedAt: new Date() } })
    revalidatePath('/taster/profile')
    return { saved: true }
  } catch (error) { return { error: error instanceof Error ? error.message : 'Could not save SMS consent' } }
}
