'use server'

import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { notificationsLog, smsThreads } from '@/db/schema'
import { requireAdminOrStaff } from '@/lib/auth/session'
import { sendSms } from '@/lib/telnyx/client'
import { Resend } from 'resend'

if (!process.env.RESEND_API_KEY) throw new Error('Missing RESEND_API_KEY')
const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendQuickEmail(
  to: string,
  recipientName: string,
  subject: string,
  body: string
) {
  const session = await requireAdminOrStaff()
  if (!to || !subject.trim() || !body.trim()) return { error: 'To, subject, and message are required.' }

  const fromDomain = process.env.RESEND_FROM_EMAIL ?? 'noreply@ahawc.com'
  const html = `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
    <p style="margin-bottom:16px">${body.replace(/\n/g, '<br/>')}</p>
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0"/>
    <p style="font-size:12px;color:#94a3b8">Sent via AHAWC Distribution Portal</p>
  </div>`

  try {
    await resend.emails.send({
      from: fromDomain,
      to,
      subject,
      html,
    })
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to send email.' }
  }
}

export async function sendDirectSms(to: string, recipientName: string, body: string) {
  const session = await requireAdminOrStaff()

  if (!to || !body.trim()) return { error: 'Phone number and message are required' }

  // Normalize phone: strip spaces/dashes/parens, ensure + prefix
  const normalized = to.replace(/[\s\-().]/g, '').replace(/^(\d{10})$/, '+1$1').replace(/^1(\d{10})$/, '+1$1')

  try {
    await sendSms({ to: normalized, body, userId: session.user.id, contactName: recipientName || null })
    await db.insert(notificationsLog).values({
      userId: session.user.id,
      recipientPhone: normalized,
      recipientName: recipientName || null,
      type: 'sms',
      message: body,
      status: 'sent',
    })
    return { success: true }
  } catch (err) {
    await db.insert(notificationsLog).values({
      userId: session.user.id,
      recipientPhone: normalized,
      recipientName: recipientName || null,
      type: 'sms',
      message: body,
      status: 'failed',
    })
    const message = err instanceof Error ? err.message : 'Failed to send SMS'
    return { error: message }
  }
}

export async function initiateCall(to: string, recipientName: string) {
  await requireAdminOrStaff()

  if (!to) return { error: 'Phone number is required' }

  const apiKey = process.env.TELNYX_API_KEY
  const from = process.env.TELNYX_FROM_NUMBER
  const connectionId = process.env.TELNYX_CALL_CONTROL_ID

  if (!apiKey || !from || !connectionId) {
    return { error: 'Voice calling is not configured (missing TELNYX_CALL_CONTROL_ID)' }
  }

  const normalized = to.replace(/[\s\-().]/g, '').replace(/^(\d{10})$/, '+1$1').replace(/^1(\d{10})$/, '+1$1')

  try {
    const res = await fetch('https://api.telnyx.com/v2/calls', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        connection_id: connectionId,
        to: normalized,
        from,
        client_state: Buffer.from(JSON.stringify({ recipientName })).toString('base64'),
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      return { error: `Call failed: ${err}` }
    }

    const data = await res.json()
    return { success: true, callControlId: data?.data?.call_control_id ?? null }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to initiate call' }
  }
}

export async function replyToSmsThread(
  _prev: { error?: string; success?: boolean } | null,
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  const session = await requireAdminOrStaff()
  const phone = (formData.get('phone') as string) || ''
  const contactName = (formData.get('contactName') as string) || ''
  const body = ((formData.get('body') as string) || '').trim()
  const mediaUrls = formData
    .getAll('mediaUrl')
    .map((value) => (typeof value === 'string' ? value : ''))
    .filter(Boolean)

  if (!phone || (!body && mediaUrls.length === 0)) {
    return { error: 'Add a message or image before sending.' }
  }

  try {
    const [thread] = await db
      .select({ groupParticipants: smsThreads.groupParticipants })
      .from(smsThreads)
      .where(eq(smsThreads.phoneNumber, phone))
      .limit(1)

    const groupParticipants = thread?.groupParticipants ?? []
    const recipients = groupParticipants.length > 0 ? [phone, ...groupParticipants] : phone

    await sendSms({
      to: recipients,
      body,
      mediaUrls,
      userId: session.user.id,
      contactName: contactName || null,
    })
    return { success: true }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Failed to send reply.' }
  }
}

export async function composeSmsThread(
  _prev: { error?: string; success?: boolean; phone?: string } | null,
  formData: FormData
): Promise<{ error?: string; success?: boolean; phone?: string }> {
  const session = await requireAdminOrStaff()
  const phone = (formData.get('phone') as string) || ''
  const contactName = (formData.get('contactName') as string) || ''
  const body = ((formData.get('body') as string) || '').trim()

  if (!phone || !body) {
    return { error: 'Select an account and enter a message.' }
  }

  try {
    await sendSms({
      to: phone,
      body,
      userId: session.user.id,
      contactName: contactName || null,
    })
    return { success: true, phone }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Failed to send text.' }
  }
}
