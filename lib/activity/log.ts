import { db } from '@/db'
import { activityEvents } from '@/db/schema'

function isMissingActivityEventsTable(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()
  return message.includes('activity_events') && message.includes('does not exist')
}

export async function logActivityEvent(input: {
  entityType: 'account' | 'order' | 'delivery' | 'tasting' | 'inbox_thread' | 'wholesale_request' | 'job' | 'invoice' | 'pricing_rule'
  entityId: string
  actorUserId?: string | null
  relatedUserId?: string | null
  kind: string
  title: string
  body?: string | null
  metadata?: Record<string, unknown>
}) {
  try {
    await db.insert(activityEvents).values({
      entityType: input.entityType,
      entityId: input.entityId,
      actorUserId: input.actorUserId ?? null,
      relatedUserId: input.relatedUserId ?? null,
      kind: input.kind,
      title: input.title,
      body: input.body ?? null,
      metadata: input.metadata ?? {},
    })
  } catch (error) {
    if (!isMissingActivityEventsTable(error)) {
      console.error('Failed to log activity event:', error)
    }
  }
}
