import { desc, eq, sql } from 'drizzle-orm'
import { db } from '@/db'
import { userAccessEvents } from '@/db/schema'

function getErrorText(error: unknown) {
  return error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()
}

export function isMissingUserAccessEventsTable(error: unknown) {
  const message = getErrorText(error)
  return message.includes('user_access_events') && message.includes('does not exist')
}

export async function recordUserAccessEvent(input: {
  userId: string | null | undefined
  eventType: 'login' | 'logout'
  provider?: string | null
}) {
  if (!input.userId) return

  try {
    await db.insert(userAccessEvents).values({
      userId: input.userId,
      eventType: input.eventType,
      provider: input.provider ?? null,
    })
  } catch (error) {
    if (!isMissingUserAccessEventsTable(error)) throw error
  }
}

export async function getUserAccessSummaryMap() {
  try {
    const rows = await db
      .select({
        userId: userAccessEvents.userId,
        lastLoginAt: sql<Date | null>`max(case when ${userAccessEvents.eventType} = 'login' then ${userAccessEvents.createdAt} end)`,
        lastLogoutAt: sql<Date | null>`max(case when ${userAccessEvents.eventType} = 'logout' then ${userAccessEvents.createdAt} end)`,
      })
      .from(userAccessEvents)
      .groupBy(userAccessEvents.userId)

    return new Map(rows.map((row) => [row.userId, row]))
  } catch (error) {
    if (isMissingUserAccessEventsTable(error)) return new Map()
    throw error
  }
}

export async function getRecentUserAccessEvents(userId: string, limit = 10) {
  try {
    return await db
      .select()
      .from(userAccessEvents)
      .where(eq(userAccessEvents.userId, userId))
      .orderBy(desc(userAccessEvents.createdAt))
      .limit(limit)
  } catch (error) {
    if (isMissingUserAccessEventsTable(error)) return []
    throw error
  }
}
