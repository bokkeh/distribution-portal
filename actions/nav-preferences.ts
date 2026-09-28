'use server'

import { and, asc, eq, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { userPinnedNavItems } from '@/db/schema'
import { requireAuth } from '@/lib/auth/session'

function isMissingTable(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()
  return message.includes('user_pinned_nav_items') && message.includes('does not exist')
}

export async function getPinnedNavKeys(userId: string): Promise<string[]> {
  try {
    const rows = await db
      .select({ navKey: userPinnedNavItems.navKey })
      .from(userPinnedNavItems)
      .where(eq(userPinnedNavItems.userId, userId))
      .orderBy(asc(userPinnedNavItems.sortOrder))
    return rows.map((row) => row.navKey)
  } catch (error) {
    if (isMissingTable(error)) return []
    throw error
  }
}

export async function togglePinnedNavItem(navKey: string): Promise<{ pinned: boolean; error?: string }> {
  try {
    const session = await requireAuth()

    const [existing] = await db
      .select({ id: userPinnedNavItems.id })
      .from(userPinnedNavItems)
      .where(and(eq(userPinnedNavItems.userId, session.user.id), eq(userPinnedNavItems.navKey, navKey)))
      .limit(1)

    if (existing) {
      await db.delete(userPinnedNavItems).where(eq(userPinnedNavItems.id, existing.id))
      revalidatePath('/', 'layout')
      return { pinned: false }
    }

    const [{ maxOrder }] = await db
      .select({ maxOrder: sql<number>`coalesce(max(${userPinnedNavItems.sortOrder}), -1)` })
      .from(userPinnedNavItems)
      .where(eq(userPinnedNavItems.userId, session.user.id))

    await db.insert(userPinnedNavItems).values({
      userId: session.user.id,
      navKey,
      sortOrder: Number(maxOrder ?? -1) + 1,
    })

    revalidatePath('/', 'layout')
    return { pinned: true }
  } catch (error) {
    if (isMissingTable(error)) {
      return { pinned: false, error: 'Pinned navigation is not enabled yet. Run npm run db:push and try again.' }
    }
    return { pinned: false, error: error instanceof Error ? error.message : 'Failed to update pin.' }
  }
}

export async function reorderPinnedNavItems(orderedNavKeys: string[]): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await requireAuth()
    await Promise.all(
      orderedNavKeys.map((navKey, index) =>
        db
          .update(userPinnedNavItems)
          .set({ sortOrder: index })
          .where(and(eq(userPinnedNavItems.userId, session.user.id), eq(userPinnedNavItems.navKey, navKey))),
      ),
    )
    revalidatePath('/', 'layout')
    return { success: true }
  } catch (error) {
    if (isMissingTable(error)) return { success: false, error: 'Pinned navigation is not enabled yet.' }
    return { success: false, error: error instanceof Error ? error.message : 'Failed to reorder pins.' }
  }
}
