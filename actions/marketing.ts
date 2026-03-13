'use server'

import { z } from 'zod'
import { headers } from 'next/headers'
import { db } from '@/db'
import { wholesaleAccountRequests } from '@/db/schema'
import { normalizePhone, setSmsSubscription, SMS_CONFIRMATION_MESSAGE, SMS_CONSENT_COPY } from '@/lib/telnyx/compliance'
import { sendSms } from '@/lib/telnyx/client'

const requestSchema = z.object({
  businessName: z.string().trim().min(2, 'Business name is required'),
  businessEmail: z.email('Enter a valid email address'),
  phone: z.string().trim().min(10, 'Enter a valid phone number'),
  smsOptIn: z.boolean(),
  source: z.string().trim().default('marketing_contact_form'),
  submissionPage: z.string().trim().optional(),
})

function isMissingRequestMetadataColumnError(error: unknown) {
  if (!error || typeof error !== 'object') return false

  const dbError = error as { code?: string; message?: string }
  if (dbError.code === '42703') return true

  const message = dbError.message?.toLowerCase() ?? ''
  return (
    message.includes('column') &&
    (message.includes('ip_address') || message.includes('user_agent'))
  )
}

export async function submitWholesaleAccountRequest(
  _prev: { error?: string; success?: boolean } | null,
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  try {
    const parsed = requestSchema.parse({
      businessName: formData.get('businessName'),
      businessEmail: formData.get('businessEmail'),
      phone: formData.get('phone'),
      smsOptIn: formData.get('smsOptIn') === 'on',
      source: formData.get('source'),
      submissionPage: formData.get('submissionPage'),
    })

    const requestHeaders = await headers()
    const phone = parsed.phone
    const phoneNormalized = normalizePhone(phone)

    const insertValues = {
      businessName: parsed.businessName,
      businessEmail: parsed.businessEmail,
      phone,
      phoneNormalized,
      smsOptIn: parsed.smsOptIn,
      smsOptInAt: parsed.smsOptIn ? new Date() : null,
      smsConsentLanguage: parsed.smsOptIn ? SMS_CONSENT_COPY : null,
      source: parsed.source,
      submissionPage: parsed.submissionPage ?? null,
      ipAddress: requestHeaders.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      userAgent: requestHeaders.get('user-agent'),
    }

    try {
      await db.insert(wholesaleAccountRequests).values(insertValues)
    } catch (error) {
      if (!isMissingRequestMetadataColumnError(error)) {
        throw error
      }

      await db.insert(wholesaleAccountRequests).values({
        businessName: insertValues.businessName,
        businessEmail: insertValues.businessEmail,
        phone: insertValues.phone,
        phoneNormalized: insertValues.phoneNormalized,
        smsOptIn: insertValues.smsOptIn,
        smsOptInAt: insertValues.smsOptInAt,
        smsConsentLanguage: insertValues.smsConsentLanguage,
        source: insertValues.source,
        submissionPage: insertValues.submissionPage,
      })
    }

    if (parsed.smsOptIn) {
      await setSmsSubscription({
        phoneNormalized,
        status: 'subscribed',
        source: 'marketing_contact_form',
        consentLanguage: SMS_CONSENT_COPY,
      })
      void sendSms({
        to: phoneNormalized,
        body: SMS_CONFIRMATION_MESSAGE,
        bypassOptOut: true,
      }).catch(error => {
        console.error('SMS confirmation failed:', error)
      })
    }

    const { sendWholesaleRequestNotification } = await import('@/lib/resend/client')
    void sendWholesaleRequestNotification({
      businessName: parsed.businessName,
      businessEmail: parsed.businessEmail,
      phone,
      phoneNormalized,
      smsOptIn: parsed.smsOptIn,
    })

    return { success: true }
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { error: err.issues[0]?.message ?? 'Invalid form submission' }
    }
    return { error: err instanceof Error ? err.message : 'Failed to submit request' }
  }
}
