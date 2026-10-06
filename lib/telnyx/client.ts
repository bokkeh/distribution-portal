import { isSmsBlocked, normalizePhone } from '@/lib/telnyx/compliance'
import { logSmsMessage } from '@/lib/telnyx/logging'

export class SmsSubmissionUnconfirmedError extends Error {}

export async function sendSmsWithReceipt({
  to,
  body,
  mediaUrls,
  bypassOptOut = false,
  userId,
  contactName,
}: {
  to: string | string[]
  body: string
  mediaUrls?: string[]
  bypassOptOut?: boolean
  userId?: string | null
  contactName?: string | null
}): Promise<string | null> {
  const apiKey = process.env.TELNYX_API_KEY
  const from = process.env.TELNYX_FROM_NUMBER

  if (!apiKey || !from) {
    throw new Error('Telnyx is not configured')
  }

  const recipients = Array.isArray(to) ? to.map(normalizePhone) : [normalizePhone(to)]

  if (!bypassOptOut) {
    for (const recipient of recipients) {
      if (await isSmsBlocked(recipient)) {
        throw new Error('Recipient has opted out of SMS')
      }
    }
  }

  const normalizedMediaUrls = (mediaUrls ?? []).filter(Boolean)
  const loggedBody = body || (normalizedMediaUrls.length ? '[Image attachment]' : '')
  const toField = recipients.length === 1 ? recipients[0] : recipients

  let res: Response
  try {
    res = await fetch('https://api.telnyx.com/v2/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from,
      to: toField,
      text: body,
      media_urls: normalizedMediaUrls.length ? normalizedMediaUrls : undefined,
    }),
    signal: AbortSignal.timeout(10000),
    })
  } catch {
    await logSmsMessage({
      userId, direction: 'outbound', phoneNumber: recipients[0], contactName,
      body: loggedBody, mediaUrls: normalizedMediaUrls,
      status: 'delivery_unconfirmed', deliveryError: 'Submission response was lost; verify delivery before retrying.',
    })
    throw new SmsSubmissionUnconfirmedError('SMS submission could not be confirmed. Verify delivery before retrying.')
  }

  const primaryPhone = recipients[0]

  if (!res.ok) {
    const errorText = await res.text()
    await logSmsMessage({
      userId,
      direction: 'outbound',
      phoneNumber: primaryPhone,
      contactName,
      body: loggedBody,
      mediaUrls: normalizedMediaUrls,
      status: 'failed',
    })
    throw new Error(`Telnyx SMS failed: ${errorText}`)
  }

  const responseBody = await res.json().catch(() => null)
  const providerMessageId = responseBody?.data?.id ?? null

  await logSmsMessage({
    userId,
    direction: 'outbound',
    phoneNumber: primaryPhone,
    contactName,
    body: loggedBody,
    mediaUrls: normalizedMediaUrls,
    status: providerMessageId ? 'queued' : 'delivery_unconfirmed',
    providerMessageId,
    deliveryError: providerMessageId ? null : 'Provider accepted submission without a message id.',
  })
  return providerMessageId
}

// Preserve the existing API for callers that only need submission to succeed.
export async function sendSms(input: Parameters<typeof sendSmsWithReceipt>[0]): Promise<void> {
  await sendSmsWithReceipt(input)
}
