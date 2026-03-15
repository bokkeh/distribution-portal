'use server'

import { and, eq, inArray, isNull, lte } from 'drizzle-orm'
import { db } from '@/db'
import { userNotifications } from '@/db/schema'
import { requireAuth } from '@/lib/auth/session'

export async function markNotificationRead(notificationId: string) {
  const session = await requireAuth()

  await db.update(userNotifications)
    .set({ readAt: new Date() })
    .where(and(eq(userNotifications.id, notificationId), eq(userNotifications.userId, session.user.id)))

  return { success: true }
}

export async function markAllNotificationsRead() {
  const session = await requireAuth()

  await db.update(userNotifications)
    .set({ readAt: new Date() })
    .where(and(eq(userNotifications.userId, session.user.id), isNull(userNotifications.readAt), lte(userNotifications.availableAt, new Date())))

  return { success: true }
}

export async function markNotificationKindsRead(kinds: string[]) {
  const session = await requireAuth()
  if (!kinds.length) return { success: true }

  await db.update(userNotifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(userNotifications.userId, session.user.id),
        isNull(userNotifications.readAt),
        lte(userNotifications.availableAt, new Date()),
        inArray(userNotifications.kind, kinds)
      )
    )

  return { success: true }
}
