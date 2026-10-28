import { NextRequest, NextResponse } from 'next/server'
import { recordContactEmailEvent } from '@/lib/resend/contact-email-events'
import { Resend } from 'resend'
import { parseWeekKey, recordCommunityUnsubscribe, type CommunityUnsubscribeReason } from '@/lib/marketing/community-email-events'
import { WEEKLY_RECIPE_TAG } from '@/lib/marketing/weekly-recipe-email'

export const runtime = 'nodejs'

/**
 * Resend webhook (subscribe to email.bounced, email.complained, email.suppressed).
 * Hard bounces, spam complaints and suppressed addresses unsubscribe the matching community contact.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET
  const apiKey = process.env.RESEND_API_KEY
  if (!secret || !apiKey) {
    return NextResponse.json({ error: 'Resend webhook is not configured' }, { status: 500 })
  }

  const payload = await request.text()
  let event: ReturnType<Resend['webhooks']['verify']>
  try {
    event = new Resend(apiKey).webhooks.verify({
      payload,
      headers: {
        id: request.headers.get('svix-id') ?? '',
        timestamp: request.headers.get('svix-timestamp') ?? '',
        signature: request.headers.get('svix-signature') ?? '',
      },
      webhookSecret: secret,
    })
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // Signed provider events are the only source of confirmed delivery.
  if ('email_id' in event.data && ['email.delivered', 'email.bounced', 'email.suppressed', 'email.failed'].includes(event.type)) {
    const tags = ('tags' in event.data ? event.data.tags : undefined) ?? {}
    const taggedId = typeof tags.contact_email_id === 'string' && /^[0-9a-f-]{36}$/i.test(tags.contact_email_id) ? tags.contact_email_id : null
    await recordContactEmailEvent({ id: request.headers.get('svix-id') ?? '', type: event.type, at: event.created_at, providerMessageId: event.data.email_id, communicationId: taggedId })
  }

  let reason: CommunityUnsubscribeReason | null = null
  let detail: string | null = null
  if (event.type === 'email.bounced') {
    // Transient bounces (full mailbox, temporary outage) shouldn't cost us a subscriber.
    if (event.data.bounce.type.toLowerCase() === 'permanent') {
      reason = 'bounce'
      detail = event.data.bounce.message || null
    }
  } else if (event.type === 'email.complained') {
    reason = 'complaint'
  } else if (event.type === 'email.suppressed') {
    reason = 'suppressed'
    detail = event.data.suppressed.message || null
  }
  if (!reason || !('to' in event.data)) return NextResponse.json({ ok: true, ignored: event.type })

  const tags = ('tags' in event.data ? event.data.tags : undefined) ?? {}
  const weekKey = tags.campaign === WEEKLY_RECIPE_TAG ? parseWeekKey(tags.week) : null
  const resolvedReason = reason
  const unsubscribed = (await Promise.all(
    event.data.to.map((email) => recordCommunityUnsubscribe({ email, reason: resolvedReason, weekKey, detail })),
  )).reduce((total, count) => total + count, 0)

  return NextResponse.json({ ok: true, type: event.type, unsubscribed })
}
