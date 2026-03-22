'use server'

import { and, eq, gte, inArray, lte } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { tasterAvailability } from '@/db/schema'
import { requireFeature } from '@/lib/auth/session'

export async function saveMyAvailability(input: {
  monthStart: string
  monthEnd: string
  dates: string[]
}) {
  const session = await requireFeature('tastings', 'taster', 'admin')
  const roles = session.user.roles ?? [session.user.role]
  if (!roles.includes('taster') && !roles.includes('admin')) {
    throw new Error('Unauthorized')
  }

  const uniqueDates = Array.from(new Set(input.dates.filter(Boolean))).sort()

  await db
    .delete(tasterAvailability)
    .where(and(
      eq(tasterAvailability.userId, session.user.id),
      gte(tasterAvailability.availableDate, input.monthStart),
      lte(tasterAvailability.availableDate, input.monthEnd),
    ))

  if (uniqueDates.length > 0) {
    await db.insert(tasterAvailability).values(
      uniqueDates.map((date) => ({
        userId: session.user.id,
        availableDate: date,
      })),
    )
  }

  revalidatePath('/taster/availability')
  revalidatePath('/admin/tastings')
  revalidatePath('/staff/tastings')

  return { success: true as const }
}

export async function getAvailabilityForUsers(userIds: string[]) {
  if (!userIds.length) return []

  return db
    .select({
      userId: tasterAvailability.userId,
      availableDate: tasterAvailability.availableDate,
    })
    .from(tasterAvailability)
    .where(inArray(tasterAvailability.userId, userIds))
}
