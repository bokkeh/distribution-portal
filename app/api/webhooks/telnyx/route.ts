import { NextRequest, NextResponse } from 'next/server'
import { sendSms } from '@/lib/telnyx/client'
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
  text?: string
  body?: string
  from?: string | { phone_number?: string }
  payload?: {
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

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const payload = (body?.data?.payload ?? body?.data ?? body) as TelnyxWebhookPayload
  const text = getInboundText(payload)
  const from = getInboundFrom(payload)

  if (!text || !from) {
    return NextResponse.json({ received: true })
  }

  const phoneNormalized = normalizePhone(from)
  const keyword = detectSmsKeyword(text)

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
