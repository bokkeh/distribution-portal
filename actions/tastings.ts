'use server'

import { desc, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import { customerAccounts, notificationsLog, tastings, users } from '@/db/schema'
import { requireFeature, requireRole } from '@/lib/auth/session'
import { sendSms } from '@/lib/telnyx/client'

function tastingRedirectPath(mode: string) {
  return mode === 'staff' ? '/staff/tastings' : '/admin/tastings'
}

async function notifyTasterAssignment({
  assignedName,
  assignedPhone,
  eventName,
  scheduledAt,
  actorId,
}: {
  assignedName: string
  assignedPhone: string | null
  eventName: string
  scheduledAt: Date
  actorId: string
}) {
  if (!assignedPhone) return

  const body = `AHAWC Tasting Assigned: ${eventName} on ${scheduledAt.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}. View details: ${process.env.NEXTAUTH_URL}/taster/tastings`

  try {
    await sendSms({ to: assignedPhone, body })
    await db.insert(notificationsLog).values({
      userId: actorId,
      recipientPhone: assignedPhone,
      recipientName: assignedName,
      type: 'sms',
      message: body,
      status: 'sent',
    })
  } catch {
    await db.insert(notificationsLog).values({
      userId: actorId,
      recipientPhone: assignedPhone,
      recipientName: assignedName,
      type: 'sms',
      message: body,
      status: 'failed',
    })
  }
}

export async function createTasting(formData: FormData) {
  const session = await requireFeature('tastings', 'admin', 'staff')
  const mode = (formData.get('mode') as string) || 'admin'
  const customerId = formData.get('customerId') as string
  const assignedUserId = formData.get('assignedUserId') as string
  const date = formData.get('date') as string
  const time = ((formData.get('time') as string) || '17:00').trim()
  const notes = ((formData.get('notes') as string) || '').trim() || null

  if (!customerId || !assignedUserId || !date) {
    redirect(`${tastingRedirectPath(mode)}?error=${encodeURIComponent('Store, taster, and date are required.')}`)
  }

  const scheduledAt = new Date(`${date}T${time}:00`)
  if (Number.isNaN(scheduledAt.getTime())) {
    redirect(`${tastingRedirectPath(mode)}?error=${encodeURIComponent('Choose a valid tasting date and time.')}`)
  }

  const [account] = await db
    .select()
    .from(customerAccounts)
    .where(eq(customerAccounts.id, customerId))
    .limit(1)

  if (!account) {
    redirect(`${tastingRedirectPath(mode)}?error=${encodeURIComponent('Store account not found.')}`)
  }

  const [assignedUser] = await db
    .select({ id: users.id, name: users.name, phone: users.phone, roles: users.roles })
    .from(users)
    .where(eq(users.id, assignedUserId))
    .limit(1)

  if (!assignedUser || !assignedUser.roles.includes('taster')) {
    redirect(`${tastingRedirectPath(mode)}?error=${encodeURIComponent('Choose a valid taster account.')}`)
  }

  const [tasting] = await db.insert(tastings).values({
    customerId: account.id,
    assignedUserId: assignedUser.id,
    createdByUserId: session.user.id,
    eventName: account.companyName,
    scheduledAt,
    storeAddress: account.address,
    storeCity: account.city,
    storeState: account.state,
    storeZip: account.zip,
    storePhone: account.phone,
    notes,
  }).returning({ id: tastings.id })

  await notifyTasterAssignment({
    assignedName: assignedUser.name,
    assignedPhone: assignedUser.phone,
    eventName: account.companyName,
    scheduledAt,
    actorId: session.user.id,
  })

  revalidatePath('/admin/tastings')
  revalidatePath('/staff/tastings')
  revalidatePath('/taster/tastings')
  redirect(`${tastingRedirectPath(mode)}?success=${encodeURIComponent('Tasting assigned.')}`)
}

export async function updateTastingStatus(formData: FormData) {
  const session = await requireRole('admin', 'staff', 'taster')
  const tastingId = formData.get('tastingId') as string
  const nextStatus = formData.get('status') as 'scheduled' | 'confirmed' | 'completed' | 'cancelled'
  const mode = (formData.get('mode') as string) || 'taster'

  const [tasting] = await db
    .select({ id: tastings.id, assignedUserId: tastings.assignedUserId })
    .from(tastings)
    .where(eq(tastings.id, tastingId))
    .limit(1)

  if (!tasting) {
    redirect(`/${mode}/tastings?error=${encodeURIComponent('Tasting not found.')}`)
  }

  const roles = session.user.roles ?? [session.user.role]
  if (!roles.includes('admin') && !roles.includes('staff') && tasting.assignedUserId !== session.user.id) {
    redirect('/unauthorized')
  }

  await db.update(tastings).set({ status: nextStatus }).where(eq(tastings.id, tastingId))

  revalidatePath('/admin/tastings')
  revalidatePath('/staff/tastings')
  revalidatePath('/taster/tastings')
  redirect(`/${mode}/tastings?success=${encodeURIComponent('Tasting updated.')}`)
}

export async function getTastingsForView({
  assignedUserId,
}: {
  assignedUserId?: string
}) {
  const base = db
    .select({
      id: tastings.id,
      customerId: tastings.customerId,
      assignedUserId: tastings.assignedUserId,
      createdByUserId: tastings.createdByUserId,
      eventName: tastings.eventName,
      scheduledAt: tastings.scheduledAt,
      status: tastings.status,
      storeAddress: tastings.storeAddress,
      storeCity: tastings.storeCity,
      storeState: tastings.storeState,
      storeZip: tastings.storeZip,
      storePhone: tastings.storePhone,
      notes: tastings.notes,
      createdAt: tastings.createdAt,
      tasterName: users.name,
      tasterPhone: users.phone,
    })
    .from(tastings)
    .innerJoin(users, eq(tastings.assignedUserId, users.id))

  const rows = assignedUserId
    ? await base.where(eq(tastings.assignedUserId, assignedUserId)).orderBy(desc(tastings.scheduledAt))
    : await base.orderBy(desc(tastings.scheduledAt))

  return rows
}
