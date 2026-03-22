add a'use server'

import { requireAuth } from '@/lib/auth/session'
import { db } from '@/db'
import { activityEvents } from '@/db/schema'

export async function saveCallNote(
  accountId: string,
  phone: string,
  accountName: string,
  notes: string,
): Promise<void> {
  const session = await requireAuth()
  if (!notes.trim()) return

  await db.insert(activityEvents).values({
    entityType: 'account',
    entityId: accountId,
    actorUserId: session.user.id,
    kind: 'call_note',
    title: `Call with ${accountName} (${phone})`,
    body: notes.trim(),
    metadata: { phone },
  })
}
