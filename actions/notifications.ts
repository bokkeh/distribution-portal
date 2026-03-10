'use server'

import { db } from '@/db'
import { notificationsLog } from '@/db/schema'
import { requireAdminOrStaff } from '@/lib/auth/session'
import { sendSms } from '@/lib/telnyx/client'

export async function sendDirectSms(to: string, recipientName: string, body: string) {
  const session = await requireAdminOrStaff()

  if (!to || !body.trim()) return { error: 'Phone number and message are required' }

  // Normalize phone: strip spaces/dashes/parens, ensure + prefix
  const normalized = to.replace(/[\s\-().]/g, '').replace(/^(\d{10})$/, '+1$1').replace(/^1(\d{10})$/, '+1$1')

  try {
    await sendSms({ to: normalized, body })
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
