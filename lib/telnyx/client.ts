import { isSmsBlocked, normalizePhone } from '@/lib/telnyx/compliance'

export async function sendSms({
  to,
  body,
  bypassOptOut = false,
}: {
  to: string
  body: string
  bypassOptOut?: boolean
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
    throw new Error(`Telnyx SMS failed: ${errorText}`)
  }
}
