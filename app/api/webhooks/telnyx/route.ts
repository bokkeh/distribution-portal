import { NextRequest, NextResponse } from 'next/server'
import { sendSms } from '@/lib/telnyx/client'
import { logSmsMessage } from '@/lib/telnyx/logging'
import {
  detectSmsKeyword,
  normalizePhone,
  setSmsSubscription,
  SMS_CONFIRMATION_MESSAGE,
  SMS_HELP_MESSAGE,
  SMS_START_MESSAGE,
  SMS_STOP_MESSAGE,
} from '@/lib/telnyx/compliance'

type TelnyxWebhookPayload = {
  id?: string
  event_type?: string
  text?: string
  body?: string
  from?: string | { phone_number?: string }
  payload?: {
    id?: string
    event_type?: string
    text?: string
    from?: { phone_number?: string }
  }
}

function getInboundText(payload: TelnyxWebhookPayload) {
  return payload?.text ?? payload?.body ?? payload?.payload?.text ?? ''
}

function getInboundFrom(payload: TelnyxWebhookPayload) {
  return (typeof payload?.from === 'object' ? payload.from?.phone_number : payload?.from)
    ?? payload?.payload?.from?.phone_number
    ?? ''
}

function getProviderMessageId(payload: TelnyxWebhookPayload) {
  return payload?.id ?? payload?.payload?.id ?? null
}

function getEventType(body: any, payload: TelnyxWebhookPayload) {
  return body?.data?.event_type ?? body?.event_type ?? payload?.event_type ?? payload?.payload?.event_type ?? ''
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const payload = (body?.data?.payload ?? body?.data ?? body) as TelnyxWebhookPayload
  const eventType = getEventType(body, payload)
  const text = getInboundText(payload)
  const from = getInboundFrom(payload)

  // Ignore outbound delivery/status events. The inbox only tracks actual inbound replies.
  if (eventType && eventType !== 'message.received') {
    return NextResponse.json({ received: true, ignored: eventType })
  }

  if (!text || !from) {
    return NextResponse.json({ received: true })
  }

  const phoneNormalized = normalizePhone(from)
  const keyword = detectSmsKeyword(text)
  const providerMessageId = getProviderMessageId(payload)

  await logSmsMessage({
    direction: 'inbound',
    phoneNumber: phoneNormalized,
    body: text,
    status: 'received',
    providerMessageId,
  })

  if (keyword === 'stop') {
    await setSmsSubscription({
      phoneNormalized,
      status: 'unsubscribed',
      source: 'telnyx_inbound_keyword',
      lastKeyword: 'STOP',
    })
    await sendSms({ to: phoneNormalized, body: SMS_STOP_MESSAGE, bypassOptOut: true })
  } else if (keyword === 'help') {
    await sendSms({ to: phoneNormalized, body: SMS_HELP_MESSAGE, bypassOptOut: true })
  } else if (keyword === 'start') {
    await setSmsSubscription({
      phoneNormalized,
      status: 'subscribed',
      source: 'telnyx_inbound_keyword',
      consentLanguage: SMS_CONFIRMATION_MESSAGE,
      lastKeyword: 'START',
    })
    await sendSms({ to: phoneNormalized, body: SMS_START_MESSAGE, bypassOptOut: true })
  }

  return NextResponse.json({ received: true })
}
