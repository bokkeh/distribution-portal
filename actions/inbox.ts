'use server'

import { and, eq, isNull, lte } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { replyTemplates, smsThreads, userNotifications, users } from '@/db/schema'
import { requireAdminOrStaff, requireAuth } from '@/lib/auth/session'
import { logActivityEvent } from '@/lib/activity/log'

function revalidateInboxViews() {
  revalidatePath('/admin/inbox')
  revalidatePath('/staff/inbox')
  revalidatePath('/admin/dashboard')
  revalidatePath('/staff/dashboard')
}

export async function updateSmsThreadMeta(
  _prev: { error?: string; success?: boolean } | null,
  formData: FormData
) {
  const session = await requireAdminOrStaff()
  const phoneNumber = (formData.get('phoneNumber') as string) || ''
  const status = (formData.get('status') as 'open' | 'resolved' | '') || ''
  const priority = (formData.get('priority') as 'normal' | 'starred' | '') || ''
  const assignedUserId = ((formData.get('assignedUserId') as string) || '').trim() || null

  if (!phoneNumber) return { error: 'Phone number is required.' }

  const values: Partial<typeof smsThreads.$inferInsert> & { updatedAt: Date } = {
    updatedAt: new Date(),
  }

  if (status) values.status = status
  if (priority) values.priority = priority
  if (formData.has('assignedUserId')) values.assignedUserId = assignedUserId

  await db.update(smsThreads).set(values).where(eq(smsThreads.phoneNumber, phoneNumber))

  await logActivityEvent({
    entityType: 'inbox_thread',
    entityId: phoneNumber,
    actorUserId: session.user.id,
    relatedUserId: assignedUserId,
    kind: 'thread_updated',
    title: 'Inbox thread updated',
    body: [
      status ? `Status: ${status}` : null,
      priority ? `Priority: ${priority}` : null,
      formData.has('assignedUserId') ? `Owner changed` : null,
    ].filter(Boolean).join(' | '),
  })

  revalidateInboxViews()
  return { success: true }
}

export async function saveReplyTemplate(
  _prev: { error?: string; success?: boolean } | null,
  formData: FormData
) {
  const session = await requireAdminOrStaff()
  const title = ((formData.get('title') as string) || '').trim()
  const category = ((formData.get('category') as string) || 'general').trim()
  const body = ((formData.get('body') as string) || '').trim()

  if (!title || !body) {
    return { error: 'Title and body are required.' }
  }

  await db.insert(replyTemplates).values({
    title,
    category,
    body,
    createdByUserId: session.user.id,
  })

  revalidateInboxViews()
  return { success: true }
}

export async function markNotificationSectionRead(kindPrefix: string) {
  const session = await requireAuth()

  await db.update(userNotifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(userNotifications.userId, session.user.id),
        isNull(userNotifications.readAt),
        lte(userNotifications.availableAt, new Date()),
        eq(userNotifications.kind, kindPrefix)
      )
    )

  revalidateInboxViews()
  revalidatePath('/customer')
  revalidatePath('/driver')
  revalidatePath('/taster')
  return { success: true }
}

export async function getAssignableInboxUsers() {
  await requireAdminOrStaff()

  return db
    .select({
      id: users.id,
      name: users.name,
    })
    .from(users)
    .where(eq(users.active, true))
}
