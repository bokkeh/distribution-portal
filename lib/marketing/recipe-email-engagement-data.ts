import 'server-only'
import { createHash } from 'node:crypto'
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/db'
import { activityEvents, communityContacts, communityRecipeEmails } from '@/db/schema'
import { calculateRecipeEngagement } from './recipe-email-engagement'
import type { RecipeTrackingPayload } from './recipe-email-tracking-token'

const ENTITY = 'recipe_email'
const KINDS = ['recipe_email_tracking_started', 'recipe_email_opened', 'recipe_email_clicked']

function eventId(value: string) {
  const hex = createHash('sha256').update(value).digest('hex').slice(0, 32)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20)}`
}

export async function markRecipeEmailTracking(sendId: string) {
  await db.insert(activityEvents).values({ id: eventId(`recipe-tracking:${sendId}`), entityType: ENTITY, entityId: sendId, kind: 'recipe_email_tracking_started', title: 'Recipe email engagement tracking enabled', metadata: { version: 1 } }).onConflictDoNothing({ target: activityEvents.id })
}

/** Called only after verifying a purpose-bound signature. Repeated opens/clicks count once per recipient/link. */
export async function recordRecipeEmailEngagement(input: RecipeTrackingPayload) {
  const [[send], [contact]] = await Promise.all([
    db.select({ id: communityRecipeEmails.id }).from(communityRecipeEmails).where(eq(communityRecipeEmails.id, input.sendId)).limit(1),
    db.select({ id: communityContacts.id }).from(communityContacts).where(eq(communityContacts.id, input.contactId)).limit(1),
  ])
  if (!send || !contact) return
  await db.insert(activityEvents).values({
    id: eventId(`recipe-engagement:${input.sendId}:${input.contactId}:${input.kind}:${input.kind === 'click' ? input.url : ''}`),
    entityType: ENTITY, entityId: input.sendId,
    kind: input.kind === 'open' ? 'recipe_email_opened' : 'recipe_email_clicked',
    title: input.kind === 'open' ? 'Recipe email opened' : 'Recipe email link clicked',
    metadata: { contactId: input.contactId, ...(input.kind === 'click' ? { url: input.url } : {}) },
  }).onConflictDoNothing({ target: activityEvents.id })
}

export async function getRecipeEmailEngagement(sends: { id: string; sentCount: number }[]) {
  const events = sends.length ? await db.select({ sendId: activityEvents.entityId, kind: activityEvents.kind, metadata: activityEvents.metadata, createdAt: activityEvents.createdAt }).from(activityEvents).where(and(eq(activityEvents.entityType, ENTITY), inArray(activityEvents.entityId, sends.map(send => send.id)), inArray(activityEvents.kind, KINDS))) : []
  return new Map(sends.map(send => [send.id, calculateRecipeEngagement(send.sentCount, events.filter(event => event.sendId === send.id))]))
}

export async function getRecipeEmailRecipientEngagement(sendId: string) {
  const events = await db.select({ kind: activityEvents.kind, metadata: activityEvents.metadata, createdAt: activityEvents.createdAt }).from(activityEvents).where(and(eq(activityEvents.entityType, ENTITY), eq(activityEvents.entityId, sendId), inArray(activityEvents.kind, ['recipe_email_opened', 'recipe_email_clicked'])))
  const recipients = new Map<string, { openedAt: string | null; clickedAt: string | null }>()
  for (const event of events) {
    const data = event.metadata as { contactId?: string }
    if (!data?.contactId) continue
    const recipient = recipients.get(data.contactId) ?? { openedAt: null, clickedAt: null }
    const field = event.kind === 'recipe_email_opened' ? 'openedAt' : 'clickedAt'
    const at = event.createdAt.toISOString()
    if (!recipient[field] || at < recipient[field]) recipient[field] = at
    recipients.set(data.contactId, recipient)
  }
  return recipients
}

