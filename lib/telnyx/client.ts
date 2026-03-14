import { isSmsBlocked, normalizePhone } from '@/lib/telnyx/compliance'
import { logSmsMessage } from '@/lib/telnyx/logging'

export async function sendSms({
  to,
  body,
  bypassOptOut = false,
  userId,
  contactName,
}: {
  to: string
  body: string
  bypassOptOut?: boolean
  userId?: string | null
  contactName?: string | null
}): Promise<void> {
  const apiKey = process.env.TELNYX_API_KEY
  const from = process.env.TELNYX_FROM_NUMBER

  if (!apiKey || !from) {
    throw new Error('Telnyx is not configured')
  }

  const normalizedTo = normalizePhone(to)
  if (!bypassOptOut && await isSmsBlocked(normalizedTo)) {
    throw new Error('Recipient has opted out of SMS')
  }

  const res = await fetch('https://api.telnyx.com/v2/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ from, to: normalizedTo, text: body }),
  })

  if (!res.ok) {
    const errorText = await res.text()
    await logSmsMessage({
      userId,
      direction: 'outbound',
      phoneNumber: normalizedTo,
      contactName,
      body,
      status: 'failed',
    })
    throw new Error(`Telnyx SMS failed: ${errorText}`)
  }

  const responseBody = await res.json().catch(() => null)
  const providerMessageId = responseBody?.data?.id ?? null

  await logSmsMessage({
    userId,
    direction: 'outbound',
    phoneNumber: normalizedTo,
    contactName,
    body,
    status: 'sent',
    providerMessageId,
  })
}
