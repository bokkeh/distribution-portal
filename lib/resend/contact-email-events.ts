import 'server-only'
import { db } from '@/db'
import { contactEmails } from '@/db/schema'
import { and, eq, or, sql } from 'drizzle-orm'
export async function recordContactEmailEvent(input: { id: string; type: string; at: string; providerMessageId: string; communicationId?: string | null }) {
  if (!['email.delivered','email.bounced','email.suppressed','email.failed'].includes(input.type)) return
  const delivered = input.type === 'email.delivered'
  const event = { id: input.id, type: input.type, at: input.at }
  await db.update(contactEmails).set({
    status: delivered ? sql`CASE WHEN ${contactEmails.status} = 'failed' THEN 'failed' ELSE 'delivered' END` : 'failed',
    error: delivered ? sql`CASE WHEN ${contactEmails.status} = 'failed' THEN ${contactEmails.error} ELSE NULL END` : input.type,
    providerMessageId: input.providerMessageId,
    deliveryEvents: sql`${contactEmails.deliveryEvents} || ${JSON.stringify([event])}::jsonb`,
  }).where(and(
    or(eq(contactEmails.providerMessageId, input.providerMessageId), input.communicationId ? eq(contactEmails.id, input.communicationId) : sql`false`),
    sql`NOT ${contactEmails.deliveryEvents} @> ${JSON.stringify([{ id: input.id }])}::jsonb`,
  ))
}
