import { and, desc, eq, inArray, isNull, lte } from 'drizzle-orm'
import { db } from '@/db'
import { userNotifications, userPreferences, users } from '@/db/schema'

function isMissingUserNotificationsTable(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()
  return message.includes('user_notifications') && message.includes('does not exist')
}

function isMissingNotificationImageColumn(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()
  return message.includes('image_url') || (message.includes('user_notifications') && message.includes('column'))
}

export type BellNotification = {
  id: string
  kind: string
  title: string
  body: string
  href: string | null
  imageUrl?: string | null
  readAt: Date | null
  createdAt: Date
}

export async function createUserNotification(input: {
  userId: string
  kind: string
  title: string
  body: string
  href?: string | null
  imageUrl?: string | null
  availableAt?: Date
}) {
  try {
    await db.insert(userNotifications).values({
      userId: input.userId,
      kind: input.kind,
      title: input.title,
      body: input.body,
      href: input.href ?? null,
      imageUrl: input.imageUrl ?? null,
      availableAt: input.availableAt ?? new Date(),
    })
  } catch (error) {
    if (isMissingNotificationImageColumn(error)) {
      await db.insert(userNotifications).values({
        userId: input.userId,
        kind: input.kind,
        title: input.title,
        body: input.body,
        href: input.href ?? null,
        availableAt: input.availableAt ?? new Date(),
      })
      return
    }
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
  imageUrl?: string | null
  availableAt?: Date
}) {
  try {
    const allUsers = await db
      .select({
        id: users.id,
        roles: users.roles,
        active: users.active,
        inAppEnabled: userPreferences.inAppNotificationsEnabled,
      })
      .from(users)
      .leftJoin(userPreferences, eq(users.id, userPreferences.userId))

    const matchingUsers = allUsers.filter(
      (user) =>
        user.active &&
        input.roles.some((role) => user.roles.includes(role)) &&
        (user.inAppEnabled ?? true),
    )

    if (!matchingUsers.length) return

    await Promise.all(matchingUsers.map(user => createUserNotification({
      userId: user.id,
      kind: input.kind,
      title: input.title,
      body: input.body,
      href: input.href ?? null,
      imageUrl: input.imageUrl ?? null,
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
    let rows: BellNotification[] = []
    try {
      rows = await db
        .select({
          id: userNotifications.id,
          kind: userNotifications.kind,
          title: userNotifications.title,
          body: userNotifications.body,
          href: userNotifications.href,
          imageUrl: userNotifications.imageUrl,
          readAt: userNotifications.readAt,
          createdAt: userNotifications.createdAt,
        })
        .from(userNotifications)
        .where(and(eq(userNotifications.userId, userId), lte(userNotifications.availableAt, new Date())))
        .orderBy(desc(userNotifications.createdAt))
        .limit(40)
    } catch (error) {
      if (!isMissingNotificationImageColumn(error)) throw error
      rows = await db
        .select({
          id: userNotifications.id,
          kind: userNotifications.kind,
          title: userNotifications.title,
          body: userNotifications.body,
          href: userNotifications.href,
          readAt: userNotifications.readAt,
          createdAt: userNotifications.createdAt,
        })
        .from(userNotifications)
        .where(and(eq(userNotifications.userId, userId), lte(userNotifications.availableAt, new Date())))
        .orderBy(desc(userNotifications.createdAt))
        .limit(40)
    }

    const unreadCount = await db.$count(
      userNotifications,
      and(eq(userNotifications.userId, userId), isNull(userNotifications.readAt), lte(userNotifications.availableAt, new Date()))
    )

    return {
      notifications: rows,
      unreadCount,
    }
  } catch (error) {
    console.error('[notifications] getBellNotificationsForUser failed:', error)
    return {
      notifications: [] as BellNotification[],
      unreadCount: 0,
    }
  }
}
