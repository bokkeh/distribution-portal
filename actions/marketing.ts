'use server'

import { z } from 'zod'
import { headers } from 'next/headers'
import { db } from '@/db'
import { wholesaleAccountRequests } from '@/db/schema'

const SMS_CONSENT_COPY = 'I agree to receive SMS messages from AHAWC about my wholesale account request and account setup. Message frequency varies. Message and data rates may apply. Reply STOP to opt out, HELP for help. Consent is not a condition of purchase.'

const requestSchema = z.object({
  businessName: z.string().trim().min(2, 'Business name is required'),
  businessEmail: z.email('Enter a valid email address'),
  phone: z.string().trim().min(10, 'Enter a valid phone number'),
  smsOptIn: z.boolean(),
  source: z.string().trim().default('marketing_contact_form'),
  submissionPage: z.string().trim().optional(),
})

function normalizePhone(input: string) {
  const digits = input.replace(/[^\d+]/g, '')
  if (/^\+1\d{10}$/.test(digits)) return digits
  if (/^1\d{10}$/.test(digits)) return `+${digits}`
  if (/^\d{10}$/.test(digits)) return `+1${digits}`
  if (/^\+\d{11,15}$/.test(digits)) return digits
  throw new Error('Enter a valid phone number')
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
    const phoneNormalized = normalizePhone(parsed.phone)

    await db.insert(wholesaleAccountRequests).values({
      businessName: parsed.businessName,
      businessEmail: parsed.businessEmail,
      phone: parsed.phone,
      phoneNormalized,
      smsOptIn: parsed.smsOptIn,
      smsOptInAt: parsed.smsOptIn ? new Date() : null,
      smsConsentLanguage: parsed.smsOptIn ? SMS_CONSENT_COPY : null,
      source: parsed.source,
      submissionPage: parsed.submissionPage ?? null,
      ipAddress: requestHeaders.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      userAgent: requestHeaders.get('user-agent'),
    })

    const { sendWholesaleRequestNotification } = await import('@/lib/resend/client')
    void sendWholesaleRequestNotification({
      businessName: parsed.businessName,
      businessEmail: parsed.businessEmail,
      phone: parsed.phone,
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
