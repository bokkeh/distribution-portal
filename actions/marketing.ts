'use server'

import { z } from 'zod'
import { headers } from 'next/headers'
import { db } from '@/db'
import { wholesaleAccountRequests, type NewWholesaleAccountRequest } from '@/db/schema'
import { sql } from 'drizzle-orm'
import { normalizePhone, setSmsSubscription, SMS_CONFIRMATION_MESSAGE, SMS_CONSENT_COPY } from '@/lib/telnyx/compliance'
import { sendSms } from '@/lib/telnyx/client'
import { createNotificationsForRoles } from '@/lib/notifications/in-app'

const requestSchema = z.object({
  businessName: z.string().trim().min(2, 'Business name is required'),
  businessEmail: z.email('Enter a valid email address'),
  phone: z.string().trim().min(10, 'Enter a valid phone number'),
  smsOptIn: z.boolean(),
  source: z.string().trim().default('marketing_contact_form'),
  submissionPage: z.string().trim().optional(),
})

async function getWholesaleRequestColumns() {
  const result = await db.execute(sql`
    select column_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'wholesale_account_requests'
  `)

  return new Set(
    result.rows
      .map(row => row.column_name)
      .filter((columnName): columnName is string => typeof columnName === 'string')
  )
}

function formatDbError(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return 'Failed to submit request'
  }

  const err = error as {
    message?: string
    code?: string
    detail?: string
    hint?: string
    table?: string
    column?: string
    constraint?: string
    cause?: unknown
  }

  const parts = [
    err.message,
    err.code ? `code=${err.code}` : undefined,
    err.table ? `table=${err.table}` : undefined,
    err.column ? `column=${err.column}` : undefined,
    err.constraint ? `constraint=${err.constraint}` : undefined,
    err.detail,
    err.hint,
  ].filter(Boolean)

  const causeMessage = err.cause ? formatDbError(err.cause) : undefined
  return [parts.join(' | '), causeMessage].filter(Boolean).join(' <- ')
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

    const fallbackInsertValues = {
      businessName: insertValues.businessName,
      businessEmail: insertValues.businessEmail,
      phone: insertValues.phone,
      phoneNormalized: insertValues.phoneNormalized,
      smsOptIn: insertValues.smsOptIn,
      smsOptInAt: insertValues.smsOptInAt,
      smsConsentLanguage: insertValues.smsConsentLanguage,
      source: insertValues.source,
      submissionPage: insertValues.submissionPage,
      ipAddress: insertValues.ipAddress,
      userAgent: insertValues.userAgent,
    }

    try {
      await db.insert(wholesaleAccountRequests).values(insertValues)
    } catch (error) {
      const availableColumns = await getWholesaleRequestColumns().catch(() => null)
      console.error('Wholesale request insert failed', {
        error: formatDbError(error),
        availableColumns: availableColumns ? Array.from(availableColumns).sort() : null,
      })

      if (!availableColumns) {
        throw error
      }

      const requiredColumns = ['business_name', 'business_email', 'sms_opt_in', 'source']
      const hasRequiredColumns = requiredColumns.every(column => availableColumns.has(column))
      if (!hasRequiredColumns) {
        throw error
      }

      const retryValues: Partial<NewWholesaleAccountRequest> = {}

      if (availableColumns.has('business_name')) retryValues.businessName = fallbackInsertValues.businessName
      if (availableColumns.has('business_email')) retryValues.businessEmail = fallbackInsertValues.businessEmail
      if (availableColumns.has('phone')) retryValues.phone = fallbackInsertValues.phone
      if (availableColumns.has('phone_normalized')) retryValues.phoneNormalized = fallbackInsertValues.phoneNormalized
      if (availableColumns.has('sms_opt_in')) retryValues.smsOptIn = fallbackInsertValues.smsOptIn
      if (availableColumns.has('sms_opt_in_at')) retryValues.smsOptInAt = fallbackInsertValues.smsOptInAt
      if (availableColumns.has('sms_consent_language')) retryValues.smsConsentLanguage = fallbackInsertValues.smsConsentLanguage
      if (availableColumns.has('source')) retryValues.source = fallbackInsertValues.source
      if (availableColumns.has('submission_page')) retryValues.submissionPage = fallbackInsertValues.submissionPage
      if (availableColumns.has('ip_address')) retryValues.ipAddress = fallbackInsertValues.ipAddress
      if (availableColumns.has('user_agent')) retryValues.userAgent = fallbackInsertValues.userAgent

      if (!retryValues.businessName || !retryValues.businessEmail) {
        throw error
      }

      await db.insert(wholesaleAccountRequests).values(retryValues as NewWholesaleAccountRequest)
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

    await createNotificationsForRoles({
      roles: ['admin'],
      kind: 'wholesale_request',
      title: 'New wholesaler request',
      body: `${parsed.businessName} submitted a wholesale account request.`,
      href: '/admin/wholesale-requests',
    })

    return { success: true }
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { error: err.issues[0]?.message ?? 'Invalid form submission' }
    }
    return { error: formatDbError(err) }
  }
}
