'use server'

import { desc, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import { customerAccounts, notificationsLog, tasterInvoices, tastingReports, tastings, users } from '@/db/schema'
import { requireFeature, requireRole } from '@/lib/auth/session'
import { sendSms } from '@/lib/telnyx/client'
import { sendTasterInvoiceNotification } from '@/lib/resend/client'

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

async function notifyTasterChange({
  recipientName,
  recipientPhone,
  actorId,
  body,
}: {
  recipientName: string
  recipientPhone: string | null
  actorId: string
  body: string
}) {
  if (!recipientPhone) return

  try {
    await sendSms({ to: recipientPhone, body })
    await db.insert(notificationsLog).values({
      userId: actorId,
      recipientPhone,
      recipientName,
      type: 'sms',
      message: body,
      status: 'sent',
    })
  } catch {
    await db.insert(notificationsLog).values({
      userId: actorId,
      recipientPhone,
      recipientName,
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

export async function deleteTasting(formData: FormData) {
  const session = await requireFeature('tastings', 'admin', 'staff')
  const tastingId = formData.get('tastingId') as string
  const mode = (formData.get('mode') as string) || 'admin'

  const [tasting] = await db
    .select({
      id: tastings.id,
      eventName: tastings.eventName,
      scheduledAt: tastings.scheduledAt,
      assignedUserId: tastings.assignedUserId,
      tasterName: users.name,
      tasterPhone: users.phone,
    })
    .from(tastings)
    .innerJoin(users, eq(tastings.assignedUserId, users.id))
    .where(eq(tastings.id, tastingId))
    .limit(1)

  if (!tasting) {
    redirect(`${tastingRedirectPath(mode)}?error=${encodeURIComponent('Tasting not found.')}`)
  }

  await db.delete(tastings).where(eq(tastings.id, tastingId))

  await notifyTasterChange({
    recipientName: tasting.tasterName,
    recipientPhone: tasting.tasterPhone,
    actorId: session.user.id,
    body: `AHAWC Tasting Cancelled: ${tasting.eventName} on ${tasting.scheduledAt.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })} has been cancelled. Please check the portal for updates.`,
  })

  revalidatePath('/admin/tastings')
  revalidatePath('/staff/tastings')
  revalidatePath('/taster/tastings')
  redirect(`${tastingRedirectPath(mode)}?success=${encodeURIComponent('Tasting removed and taster notified.')}`)
}

export async function reassignTasting(formData: FormData) {
  const session = await requireFeature('tastings', 'admin', 'staff')
  const tastingId = formData.get('tastingId') as string
  const nextAssignedUserId = formData.get('assignedUserId') as string
  const mode = (formData.get('mode') as string) || 'admin'

  if (!nextAssignedUserId) {
    redirect(`${tastingRedirectPath(mode)}?error=${encodeURIComponent('Select a taster to reassign this tasting.')}`)
  }

  const [tasting] = await db
    .select({
      id: tastings.id,
      eventName: tastings.eventName,
      scheduledAt: tastings.scheduledAt,
      assignedUserId: tastings.assignedUserId,
      currentTasterName: users.name,
      currentTasterPhone: users.phone,
    })
    .from(tastings)
    .innerJoin(users, eq(tastings.assignedUserId, users.id))
    .where(eq(tastings.id, tastingId))
    .limit(1)

  if (!tasting) {
    redirect(`${tastingRedirectPath(mode)}?error=${encodeURIComponent('Tasting not found.')}`)
  }

  if (tasting.assignedUserId === nextAssignedUserId) {
    redirect(`${tastingRedirectPath(mode)}?success=${encodeURIComponent('Tasting already assigned to that taster.')}`)
  }

  const [nextTaster] = await db
    .select({ id: users.id, name: users.name, phone: users.phone, roles: users.roles })
    .from(users)
    .where(eq(users.id, nextAssignedUserId))
    .limit(1)

  if (!nextTaster || !nextTaster.roles.includes('taster')) {
    redirect(`${tastingRedirectPath(mode)}?error=${encodeURIComponent('Choose a valid taster account.')}`)
  }

  await db.update(tastings).set({
    assignedUserId: nextTaster.id,
  }).where(eq(tastings.id, tastingId))

  await Promise.all([
    notifyTasterChange({
      recipientName: tasting.currentTasterName,
      recipientPhone: tasting.currentTasterPhone,
      actorId: session.user.id,
      body: `AHAWC Tasting Reassigned: ${tasting.eventName} on ${tasting.scheduledAt.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })} has been reassigned to another taster.`,
    }),
    notifyTasterChange({
      recipientName: nextTaster.name,
      recipientPhone: nextTaster.phone,
      actorId: session.user.id,
      body: `AHAWC Tasting Assigned: ${tasting.eventName} on ${tasting.scheduledAt.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })} has been assigned to you. View details: ${process.env.NEXTAUTH_URL}/taster/tastings`,
    }),
  ])

  revalidatePath('/admin/tastings')
  revalidatePath('/staff/tastings')
  revalidatePath('/taster/tastings')
  redirect(`${tastingRedirectPath(mode)}?success=${encodeURIComponent('Tasting reassigned and tasters notified.')}`)
}

export async function submitTastingReport(formData: FormData) {
  const session = await requireFeature('tastings', 'taster', 'admin')
  const tastingId = formData.get('tastingId') as string

  const [tasting] = await db
    .select({
      id: tastings.id,
      assignedUserId: tastings.assignedUserId,
    })
    .from(tastings)
    .where(eq(tastings.id, tastingId))
    .limit(1)

  if (!tasting) {
    redirect(`/taster/tastings?error=${encodeURIComponent('Tasting not found.')}`)
  }

  const roles = session.user.roles ?? [session.user.role]
  if (!roles.includes('admin') && tasting.assignedUserId !== session.user.id) {
    redirect('/unauthorized')
  }

  const payload = {
    submittedByUserId: session.user.id,
    actualStartTime: ((formData.get('actualStartTime') as string) || '').trim() || null,
    actualEndTime: ((formData.get('actualEndTime') as string) || '').trim() || null,
    samplesServed: Number(formData.get('samplesServed') || 0) || 0,
    bottlesSold: Number(formData.get('bottlesSold') || 0) || 0,
    casesSold: Number(formData.get('casesSold') || 0) || 0,
    consumerInteractions: Number(formData.get('consumerInteractions') || 0) || 0,
    accountFeedback: ((formData.get('accountFeedback') as string) || '').trim() || null,
    highlights: ((formData.get('highlights') as string) || '').trim() || null,
    issues: ((formData.get('issues') as string) || '').trim() || null,
    followUpNeeded: formData.get('followUpNeeded') === 'on',
    followUpNotes: ((formData.get('followUpNotes') as string) || '').trim() || null,
  }

  const [existing] = await db
    .select({ id: tastingReports.id })
    .from(tastingReports)
    .where(eq(tastingReports.tastingId, tastingId))
    .limit(1)

  if (existing) {
    await db.update(tastingReports).set(payload).where(eq(tastingReports.tastingId, tastingId))
  } else {
    await db.insert(tastingReports).values({
      tastingId,
      ...payload,
    })
  }

  revalidatePath('/admin/tastings')
  revalidatePath('/staff/tastings')
  revalidatePath('/taster/tastings')
  redirect(`/taster/tastings/${tastingId}?success=${encodeURIComponent('Tasting report submitted.')}`)
}

export async function submitTasterInvoice(formData: FormData) {
  const session = await requireFeature('tastings', 'taster', 'admin')
  const tastingId = formData.get('tastingId') as string

  const [tasting] = await db
    .select({
      id: tastings.id,
      assignedUserId: tastings.assignedUserId,
      eventName: tastings.eventName,
      scheduledAt: tastings.scheduledAt,
      storeAddress: tastings.storeAddress,
      storeCity: tastings.storeCity,
      storeState: tastings.storeState,
      storeZip: tastings.storeZip,
    })
    .from(tastings)
    .where(eq(tastings.id, tastingId))
    .limit(1)

  if (!tasting) {
    redirect(`/taster/tastings?error=${encodeURIComponent('Tasting not found.')}`)
  }

  const roles = session.user.roles ?? [session.user.role]
  if (!roles.includes('admin') && tasting.assignedUserId !== session.user.id) {
    redirect('/unauthorized')
  }

  const hourlyRate = (formData.get('hourlyRate') as string) || '0'
  const hoursWorked = (formData.get('hoursWorked') as string) || '0'
  const mileage = (formData.get('mileage') as string) || '0'
  const expenseAmount = (formData.get('expenseAmount') as string) || '0'
  const totalAmount = (formData.get('totalAmount') as string) || '0'

  const payload = {
    submittedByUserId: session.user.id,
    payeeName: (formData.get('payeeName') as string) || session.user.name || 'Taster',
    payeeEmail: (formData.get('payeeEmail') as string) || session.user.email || '',
    payeePhone: (formData.get('payeePhone') as string) || null,
    hourlyRate,
    hoursWorked,
    mileage,
    expenseAmount,
    totalAmount,
    notes: ((formData.get('notes') as string) || '').trim() || null,
    status: 'submitted' as const,
  }

  const [existing] = await db
    .select({ id: tasterInvoices.id })
    .from(tasterInvoices)
    .where(eq(tasterInvoices.tastingId, tastingId))
    .limit(1)

  if (existing) {
    await db.update(tasterInvoices).set(payload).where(eq(tasterInvoices.tastingId, tastingId))
  } else {
    await db.insert(tasterInvoices).values({
      tastingId,
      ...payload,
    })
  }

  await sendTasterInvoiceNotification({
    payeeName: payload.payeeName,
    payeeEmail: payload.payeeEmail,
    payeePhone: payload.payeePhone,
    tastingName: tasting.eventName,
    tastingDate: tasting.scheduledAt.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }),
    storeAddress: [tasting.storeAddress, tasting.storeCity, tasting.storeState, tasting.storeZip].filter(Boolean).join(', '),
    hourlyRate,
    hoursWorked,
    mileage,
    expenseAmount,
    totalAmount,
    notes: payload.notes,
  })

  revalidatePath('/admin/tastings')
  revalidatePath('/staff/tastings')
  revalidatePath('/taster/tastings')
  redirect(`/taster/tastings/${tastingId}?success=${encodeURIComponent('Invoice submitted to accounting.')}`)
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
      reportSubmittedAt: tastingReports.submittedAt,
      invoiceSubmittedAt: tasterInvoices.submittedAt,
      invoiceStatus: tasterInvoices.status,
    })
    .from(tastings)
    .innerJoin(users, eq(tastings.assignedUserId, users.id))
    .leftJoin(tastingReports, eq(tastingReports.tastingId, tastings.id))
    .leftJoin(tasterInvoices, eq(tasterInvoices.tastingId, tastings.id))

  const rows = assignedUserId
    ? await base.where(eq(tastings.assignedUserId, assignedUserId)).orderBy(desc(tastings.scheduledAt))
    : await base.orderBy(desc(tastings.scheduledAt))

  return rows
}
