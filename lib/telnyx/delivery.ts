import { and, asc, eq, gte, inArray, isNotNull } from 'drizzle-orm'
import { db } from '@/db'
import { notificationsLog, scheduledSmsJobs, smsMessages } from '@/db/schema'
import { normalizePhone } from './compliance'
import { getSmsDeliveryUpdates, getMutableSmsStatuses, isFinalSmsStatus } from './delivery-status'

export async function applySmsDeliveryReceipt(providerMessageId: string, payload: unknown) {
  let updated = 0
  for (const update of getSmsDeliveryUpdates(payload)) {
    const phone = normalizePhone(update.phoneNumber)
    const allowed = getMutableSmsStatuses(update.status)
    const rows = await db.update(smsMessages).set({ status: update.status, deliveryError: update.error })
      .where(and(eq(smsMessages.providerMessageId, providerMessageId), eq(smsMessages.phoneNumber, phone),
        inArray(smsMessages.status, allowed))).returning({ id: smsMessages.id })
    updated += rows.length
    // Intermediate receipts must never overwrite a terminal carrier result.
    if (isFinalSmsStatus(update.status)) {
      await db.update(scheduledSmsJobs).set({ status: update.status, lastError: update.error })
        .where(and(eq(scheduledSmsJobs.providerMessageId, providerMessageId),
          inArray(scheduledSmsJobs.status, ['submitted', 'sent', 'sending', 'delivery_unconfirmed'])))
      await db.update(notificationsLog).set({ status: update.status })
        .where(and(eq(notificationsLog.providerMessageId, providerMessageId),
          inArray(notificationsLog.status, allowed)))
    }
  }
  return updated
}

/** Polling repairs missed webhooks. It never retries or sends a message. */
export async function reconcileSmsDeliveryStatuses(limit = 10) {
  if (!process.env.TELNYX_API_KEY) return { checked: 0, updated: 0, errors: 0 }
  const recent = new Date(Date.now() - 7 * 24 * 3600000)
  const rows = await db.selectDistinct({ id: smsMessages.providerMessageId }).from(smsMessages)
    .where(and(eq(smsMessages.direction, 'outbound'), inArray(smsMessages.status, ['queued', 'sent']),
      isNotNull(smsMessages.providerMessageId), gte(smsMessages.createdAt, recent)))
    .orderBy(asc(smsMessages.providerMessageId)).limit(limit)
  // Also repair receipts that arrived between submission and saving the job's id.
  const jobs = await db.select({ id: scheduledSmsJobs.providerMessageId }).from(scheduledSmsJobs)
    .where(and(inArray(scheduledSmsJobs.status, ['submitted', 'delivery_unconfirmed']), isNotNull(scheduledSmsJobs.providerMessageId),
      gte(scheduledSmsJobs.sentAt, recent))).limit(limit)
  const ids = [...new Set([...rows, ...jobs].map(row => row.id).filter((id): id is string => Boolean(id)))]
  const result = { checked: 0, updated: 0, errors: 0 }
  for (let offset = 0; offset < ids.length; offset += 5) {
    const outcomes = await Promise.allSettled(ids.slice(offset, offset + 5).map(async id => {
      const response = await fetch(`https://api.telnyx.com/v2/messages/${encodeURIComponent(id)}`, {
        headers: { Authorization: `Bearer ${process.env.TELNYX_API_KEY}` },
        signal: AbortSignal.timeout(5000), cache: 'no-store',
      })
      if (!response.ok) throw new Error(`Telnyx receipt lookup failed (${response.status})`)
      const body = await response.json()
      return applySmsDeliveryReceipt(id, body.data)
    }))
    for (const outcome of outcomes) {
      result.checked += 1
      if (outcome.status === 'fulfilled') result.updated += outcome.value
      else { result.errors += 1; console.error('SMS delivery reconciliation failed:', outcome.reason) }
    }
  }
  return result
}
