import { and, desc, eq, inArray, isNull, lte } from 'drizzle-orm'
import { db } from '@/db'
import { userNotifications, users } from '@/db/schema'

function isMissingUserNotificationsTable(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()
  return message.includes('user_notifications') && message.includes('does not exist')
}

export type BellNotification = {
  id: string
  title: string
  body: string
  href: string | null
  readAt: Date | null
  createdAt: Date
}

export async function createUserNotification(input: {
  userId: string
  kind: string
  title: string
  body: string
  href?: string | null
  availableAt?: Date
}) {
  try {
    await db.insert(userNotifications).values({
      userId: input.userId,
      kind: input.kind,
      title: input.title,
      body: input.body,
      href: input.href ?? null,
      availableAt: input.availableAt ?? new Date(),
    })
  } catch (error) {
    if (!isMissingUserNotificationsTable(error)) {
      console.error('Failed to create user notification:', error)
    }
  }
}

export async function createNotificationsForRoles(input: {
  roles: string[]
  kind: string
  title: string
  body: string
  href?: string | null
  availableAt?: Date
}) {
  try {
    const allUsers = await db.select({
      id: users.id,
      roles: users.roles,
      active: users.active,
    }).from(users)

    const matchingUsers = allUsers.filter(user =>
      user.active && input.roles.some(role => user.roles.includes(role))
    )

    if (!matchingUsers.length) return

    await Promise.all(matchingUsers.map(user => createUserNotification({
      userId: user.id,
      kind: input.kind,
      title: input.title,
      body: input.body,
      href: input.href ?? null,
      availableAt: input.availableAt,
    })))
  } catch (error) {
    if (!isMissingUserNotificationsTable(error)) {
      console.error('Failed to create role notifications:', error)
    }
  }
}

export async function clearUserNotifications(input: {
  userId: string
  href?: string | null
  kinds?: string[]
}) {
  try {
    const conditions = [eq(userNotifications.userId, input.userId)]

    if (input.href) {
      conditions.push(eq(userNotifications.href, input.href))
    }

    if (input.kinds?.length) {
      conditions.push(inArray(userNotifications.kind, input.kinds))
    }

    await db.delete(userNotifications).where(and(...conditions))
  } catch (error) {
    if (!isMissingUserNotificationsTable(error)) {
      console.error('Failed to clear user notifications:', error)
    }
  }
}

export async function getBellNotificationsForUser(userId: string) {
  try {
    const rows = await db
      .select({
        id: userNotifications.id,
        title: userNotifications.title,
        body: userNotifications.body,
        href: userNotifications.href,
        readAt: userNotifications.readAt,
        createdAt: userNotifications.createdAt,
      })
      .from(userNotifications)
      .where(and(eq(userNotifications.userId, userId), lte(userNotifications.availableAt, new Date())))
      .orderBy(desc(userNotifications.createdAt))
      .limit(12)

    const unreadCount = await db.$count(
      userNotifications,
      and(eq(userNotifications.userId, userId), isNull(userNotifications.readAt), lte(userNotifications.availableAt, new Date()))
    )

    return {
      notifications: rows,
      unreadCount,
    }
  } catch (error) {
    if (!isMissingUserNotificationsTable(error)) throw error
    return {
      notifications: [] as BellNotification[],
      unreadCount: 0,
    }
  }
}
