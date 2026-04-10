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
import { createNotificationsForRoles } from '@/lib/notifications/in-app'
import { isTelnyxWebhookVerificationConfigured, verifyTelnyxWebhookSignature } from '@/lib/telnyx/webhook'

type TelnyxWebhookPayload = {
  id?: string
  event_type?: string
  text?: string
  body?: string
  from?: string | { phone_number?: string }
  to?: Array<{ phone_number?: string }> | string
  payload?: {
    id?: string
    event_type?: string
    text?: string
    from?: { phone_number?: string }
    to?: Array<{ phone_number?: string }> | string
  }
  media?: Array<{ url?: string }>
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

function getGroupParticipants(body: any, payload: TelnyxWebhookPayload, fromPhone: string): string[] {
  const ownNumber = (process.env.TELNYX_FROM_NUMBER ?? '').replace(/\D/g, '')
  const toField = body?.data?.payload?.to ?? body?.data?.to ?? payload?.to ?? payload?.payload?.to
  if (!toField) return []
  const entries = Array.isArray(toField) ? toField : []
  return entries
    .map((e: { phone_number?: string } | string) => typeof e === 'string' ? e : (e?.phone_number ?? ''))
    .filter(Boolean)
    .filter((num: string) => {
      const digits = num.replace(/\D/g, '')
      return digits !== ownNumber && num !== fromPhone
    })
}

function getInboundMediaUrls(body: any, payload: TelnyxWebhookPayload) {
  const media = body?.data?.payload?.media ?? body?.data?.media ?? payload?.media ?? []
  if (!Array.isArray(media)) return []
  return media
    .map((item: { url?: string }) => item?.url)
    .filter((url: string | undefined): url is string => Boolean(url))
}

function getEventType(body: any, payload: TelnyxWebhookPayload) {
  return body?.data?.event_type ?? body?.event_type ?? payload?.event_type ?? payload?.payload?.event_type ?? ''
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text().catch(() => null)
  if (!rawBody) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  if (!isTelnyxWebhookVerificationConfigured()) {
    console.error('TELNYX_WEBHOOK_PUBLIC_KEY is not configured; rejecting webhook.')
    return NextResponse.json({ error: 'Webhook verification is not configured' }, { status: 503 })
  }

  const isVerified = await verifyTelnyxWebhookSignature({
    payload: rawBody,
    signatureHeader: req.headers.get('telnyx-signature-ed25519'),
    timestampHeader: req.headers.get('telnyx-timestamp'),
  })

  if (!isVerified) {
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 })
  }

  const body = await (async () => {
    try {
      return JSON.parse(rawBody) as Record<string, any>
    } catch {
      return null
    }
  })()
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const payload = (body?.data?.payload ?? body?.data ?? body) as TelnyxWebhookPayload
  const eventType = getEventType(body, payload)
  const text = getInboundText(payload)
  const from = getInboundFrom(payload)
  const mediaUrls = getInboundMediaUrls(body, payload)

  // Ignore outbound delivery/status events. The inbox only tracks actual inbound replies.
  if (eventType && eventType !== 'message.received') {
    return NextResponse.json({ received: true, ignored: eventType })
  }

  if ((!text && mediaUrls.length === 0) || !from) {
    return NextResponse.json({ received: true })
  }

  const phoneNormalized = normalizePhone(from)
  const keyword = detectSmsKeyword(text)
  const providerMessageId = getProviderMessageId(payload)
  const groupParticipants = getGroupParticipants(body, payload, phoneNormalized)

  await logSmsMessage({
    direction: 'inbound',
    phoneNumber: phoneNormalized,
    body: text || '[Image attachment]',
    mediaUrls,
    status: 'received',
    providerMessageId,
    groupParticipants: groupParticipants.length ? groupParticipants : undefined,
  })

  const alertPhone = process.env.ADMIN_NOTIFICATION_PHONE

  await Promise.all([
    createNotificationsForRoles({
      roles: ['admin'],
      kind: 'sms_received',
      title: 'New inbound text',
      body: `New SMS reply from ${phoneNormalized}.`,
      href: '/admin/inbox',
    }),
    createNotificationsForRoles({
      roles: ['staff'],
      kind: 'sms_received',
      title: 'New inbound text',
      body: `New SMS reply from ${phoneNormalized}.`,
      href: '/staff/inbox',
    }),
    alertPhone
      ? sendSms({
          to: alertPhone,
          body: `New text from ${phoneNormalized}: ${text ? text.slice(0, 160) : '[image]'}`,
          bypassOptOut: true,
        }).catch(() => {})
      : Promise.resolve(),
  ])

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
