import { and, desc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { activityEvents, users } from '@/db/schema'

export type TimelineItem = {
  id: string
  kind: string
  title: string
  body: string | null
  createdAt: Date
  actorName: string | null
}

function isMissingActivityEventsTable(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()
  return message.includes('activity_events') && message.includes('does not exist')
}

export async function getActivityTimeline(
  entityType: 'account' | 'community_contact' | 'event' | 'order' | 'delivery' | 'tasting' | 'inbox_thread' | 'wholesale_request' | 'job' | 'pricing_rule',
  entityId: string,
  fallbackItems: TimelineItem[] = []
) {
  try {
    const rows = await db
      .select({
        id: activityEvents.id,
        kind: activityEvents.kind,
        title: activityEvents.title,
        body: activityEvents.body,
        createdAt: activityEvents.createdAt,
        actorName: users.name,
      })
      .from(activityEvents)
      .leftJoin(users, eq(activityEvents.actorUserId, users.id))
      .where(and(eq(activityEvents.entityType, entityType), eq(activityEvents.entityId, entityId)))
      .orderBy(desc(activityEvents.createdAt))

    return [...rows, ...fallbackItems].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  } catch (error) {
    if (!isMissingActivityEventsTable(error)) {
      console.error('Failed to load activity timeline:', error)
    }
    return fallbackItems.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  }
}
