'use server'

import { requireAdminOrStaff } from '@/lib/auth/session'
import { sendSms } from '@/lib/telnyx/client'

export async function sendMapAccountSms(
  phone: string,
  accountName: string,
  message: string,
): Promise<{ ok: boolean; error?: string }> {
  const session = await requireAdminOrStaff()
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
