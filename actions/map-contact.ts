'use server'

import { requireAuth } from '@/lib/auth/session'
import { sendSms } from '@/lib/telnyx/client'

export async function getTelnyxWebRtcToken(): Promise<{ token: string; callerNumber: string }> {
  await requireAuth()
  const credentialId = process.env.TELNYX_WEBRTC_CREDENTIAL_ID
  const apiKey = process.env.TELNYX_API_KEY
  const callerNumber = process.env.TELNYX_FROM_NUMBER ?? process.env.NEXT_PUBLIC_TELNYX_FROM_NUMBER
  if (!credentialId || !apiKey || !callerNumber) throw new Error('Telnyx WebRTC not configured')

  const res = await fetch(
    `https://api.telnyx.com/v2/telephony_credentials/${credentialId}/token`,
    { method: 'POST', headers: { Authorization: `Bearer ${apiKey}` } },
  )
  if (!res.ok) {
    console.error('[telnyx-call] token request failed', { status: res.status })
    throw new Error(`Failed to get WebRTC token (${res.status})`)
  }

  const token = (await res.text()).trim()
  if (!token) throw new Error('Telnyx returned an empty WebRTC token')

  return { token, callerNumber }
}

export async function sendMapAccountSms(
  phone: string,
  accountName: string,
  message: string,
): Promise<{ ok: boolean; error?: string }> {
  const session = await requireAuth()
  if (!message.trim()) return { ok: false, error: 'Message is empty' }

  try {
    await sendSms({
      to: phone,
      body: message.trim(),
      userId: session.user.id,
      contactName: accountName,
    })
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Failed to send' }
  }
}
