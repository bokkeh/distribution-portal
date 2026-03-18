'use server'

import { desc, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import { customerAccounts, notificationsLog, tasterInvoices, tastingReports, tastings, users } from '@/db/schema'
import { requireFeature, requireRole } from '@/lib/auth/session'
import { sendSms } from '@/lib/telnyx/client'
import {
  sendInternalAlertEmail,
  sendTasterAssignmentEmail,
  sendTasterInvoiceNotification,
  sendTastingReportReceivedEmail,
  sendTastingStatusEmail,
} from '@/lib/resend/client'
import { clearUserNotifications, createNotificationsForRoles, createUserNotification } from '@/lib/notifications/in-app'
import {
  clearScheduledTastingSmsJobs,
  formatTastingSmsPayload,
  queueScheduledTastingSmsJobs,
  sendTastingSmsFromTemplate,
} from '@/lib/tastings/sms-series'
import { getTastingById, getTastingsForViewWithFallback } from '@/lib/tastings/read'
import { formatEasternDateTime, parseDateTimeInTimeZone } from '@/lib/tastings/time'
import { logActivityEvent } from '@/lib/activity/log'
import { getUserPreferences } from '@/lib/preferences/read'

function tastingRedirectPath(mode: string) {
  return mode === 'staff' ? '/staff/tastings' : '/admin/tastings'
}

function uniqueEmails(...values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => value?.trim()).filter(Boolean) as string[]))
}

async function notifyTasterAssignment({
  assignedPhone,
  payload,
}: {
  assignedPhone: string | null
  payload: ReturnType<typeof formatTastingSmsPayload>
}) {
  if (!assignedPhone) return

  try {
    await sendTastingSmsFromTemplate({ templateKey: 'assignment', payload })
  } catch {
    await db.insert(notificationsLog).values({
      userId: payload.userId,
      recipientPhone: assignedPhone,
      recipientName: payload.store_name,
      type: 'sms',
      message: `Failed to send tasting assignment for ${payload.store_name}`,
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

async function notifyTeamAboutDeclinedTasting({
  tastingId,
  eventName,
  scheduledAt,
  declinedByName,
}: {
  tastingId: string
  eventName: string
  scheduledAt: Date
  declinedByName: string
}) {
  const teamMessage = `AHAWC Tasting Declined: ${declinedByName} declined ${eventName} on ${formatEasternDateTime(scheduledAt)}. Review it in the portal.`

  await createNotificationsForRoles({
    roles: ['admin', 'staff'],
    kind: 'tasting_declined',
    title: 'Tasting declined',
    body: `${declinedByName} declined ${eventName}.`,
    href: '/admin/tastings',
  })

  const teamMembers = await db
    .select({ id: users.id, phone: users.phone, roles: users.roles, active: users.active })
    .from(users)

  const recipients = new Map<string, string>()
  const emailRecipients = new Set<string>()
  for (const member of teamMembers) {
    if (!member.active) continue
    if (!member.phone) continue
    if (!member.roles.includes('staff') && !member.roles.includes('admin')) continue
    recipients.set(member.phone, member.id)
  }

  const teamEmails = await db
    .select({ email: users.email, roles: users.roles, active: users.active })
    .from(users)

  for (const member of teamEmails) {
    if (!member.active) continue
    if (!member.email) continue
    if (!member.roles.includes('staff') && !member.roles.includes('admin')) continue
    emailRecipients.add(member.email)
  }

  await Promise.all(Array.from(recipients.entries()).map(async ([phone, userId]) => {
    try {
      await sendSms({ to: phone, body: teamMessage, userId, contactName: 'AHAWC team' })
    } catch {
      await db.insert(notificationsLog).values({
        userId,
        recipientPhone: phone,
        recipientName: 'AHAWC team',
        type: 'sms',
        message: teamMessage,
        status: 'failed',
      })
    }
  }))

  await logActivityEvent({
    entityType: 'tasting',
    entityId: tastingId,
    kind: 'tasting_declined_notified',
    title: 'Team notified of decline',
    body: `${declinedByName} declined ${eventName} and the team was notified.`,
  })

  if (emailRecipients.size) {
    await sendInternalAlertEmail({
      to: Array.from(emailRecipients),
      subject: `Tasting declined - ${eventName}`,
      title: 'Tasting declined',
      body: `${declinedByName} declined ${eventName} scheduled for ${formatEasternDateTime(scheduledAt)}.`,
      href: '/admin/tastings',
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
  const endTime = ((formData.get('endTime') as string) || '').trim()
  const notes = ((formData.get('notes') as string) || '').trim() || null

  if (!customerId || !assignedUserId || !date) {
    redirect(`${tastingRedirectPath(mode)}?error=${encodeURIComponent('Store, taster, and date are required.')}`)
  }

  const scheduledAt = parseDateTimeInTimeZone(date, time)
  if (Number.isNaN(scheduledAt.getTime())) {
    redirect(`${tastingRedirectPath(mode)}?error=${encodeURIComponent('Choose a valid tasting date and time.')}`)
  }
  const endAt = endTime ? parseDateTimeInTimeZone(date, endTime) : null
  if (endAt && Number.isNaN(endAt.getTime())) {
    redirect(`${tastingRedirectPath(mode)}?error=${encodeURIComponent('Choose a valid tasting end time.')}`)
  }
  if (endAt && endAt <= scheduledAt) {
    redirect(`${tastingRedirectPath(mode)}?error=${encodeURIComponent('End time must be after the start time.')}`)
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
    .select({ id: users.id, name: users.name, phone: users.phone, email: users.email, roles: users.roles })
    .from(users)
    .where(eq(users.id, assignedUserId))
    .limit(1)

  if (!assignedUser || !assignedUser.roles.includes('taster')) {
    redirect(`${tastingRedirectPath(mode)}?error=${encodeURIComponent('Choose a valid taster account.')}`)
  }
  const assignedUserPrefs = await getUserPreferences(assignedUser.id).catch(() => null)

  const [tasting] = await db.insert(tastings).values({
    customerId: account.id,
    assignedUserId: assignedUser.id,
    createdByUserId: session.user.id,
    eventName: account.companyName,
    scheduledAt,
    endAt,
    storeAddress: account.address,
    storeCity: account.city,
    storeState: account.state,
    storeZip: account.zip,
    storePhone: account.phone,
    notes,
  }).returning({ id: tastings.id })

  const smsPayload = formatTastingSmsPayload({
    tastingId: tasting.id,
    userId: assignedUser.id,
    phoneNumber: assignedUser.phone ?? '',
    storeName: account.companyName,
    storeAddress: [account.address, account.city, account.state, account.zip].filter(Boolean).join(', ') || 'Store address not provided',
    scheduledAt,
    endAt,
  })

  if (assignedUserPrefs?.smsNotificationsEnabled ?? true) {
    await notifyTasterAssignment({
      assignedPhone: assignedUser.phone,
      payload: smsPayload,
    })
  }

  if (assignedUser.phone && (assignedUserPrefs?.smsNotificationsEnabled ?? true)) {
    await queueScheduledTastingSmsJobs({
      ...smsPayload,
      scheduledAt,
      endAt,
    })
  }

  if (assignedUserPrefs?.inAppNotificationsEnabled ?? true) {
    await createUserNotification({
      userId: assignedUser.id,
      kind: 'tasting_assigned',
      title: 'New tasting assigned',
      body: `${account.companyName} has been assigned to you for ${formatEasternDateTime(scheduledAt)}.`,
      href: `/taster/tastings/${tasting.id}`,
    })
  }

  if (assignedUserPrefs?.inAppNotificationsEnabled ?? true) {
    await createUserNotification({
      userId: assignedUser.id,
      kind: 'tasting_report_reminder',
      title: 'Complete your tasting report',
      body: `Submit your tasting report for ${account.companyName}.`,
      href: `/taster/tastings/${tasting.id}`,
      availableAt: new Date(scheduledAt.getTime() + 24 * 60 * 60 * 1000),
    })
  }

  if (assignedUser.email && (assignedUserPrefs?.emailNotificationsEnabled ?? true)) {
    await sendTasterAssignmentEmail({
      to: assignedUser.email,
      tasterName: assignedUser.name,
      storeName: account.companyName,
      scheduledAt,
      endAt,
      notes,
    })
  }

  revalidatePath('/admin/tastings')
  revalidatePath('/staff/tastings')
  revalidatePath('/taster/tastings')
  revalidatePath('/taster/payouts')
  await logActivityEvent({
    entityType: 'tasting',
    entityId: tasting.id,
    actorUserId: session.user.id,
    relatedUserId: assignedUser.id,
    kind: 'tasting_created',
    title: 'Tasting scheduled',
    body: `${account.companyName} was assigned to ${assignedUser.name}.`,
  })
  redirect(`${tastingRedirectPath(mode)}?success=${encodeURIComponent('Tasting assigned.')}`)
}

export async function updateTastingStatus(formData: FormData) {
  const session = await requireRole('admin', 'staff', 'taster')
  const tastingId = formData.get('tastingId') as string
  const nextStatus = formData.get('status') as 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'declined'
  const mode = (formData.get('mode') as string) || 'taster'

  const [tasting] = await db
    .select({
      id: tastings.id,
      assignedUserId: tastings.assignedUserId,
      eventName: tastings.eventName,
      scheduledAt: tastings.scheduledAt,
    })
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
  await logActivityEvent({
    entityType: 'tasting',
    entityId: tastingId,
    actorUserId: session.user.id,
    kind: 'tasting_status_changed',
    title: 'Tasting status updated',
    body: `Status changed to ${nextStatus.replace(/_/g, ' ')}.`,
  })

  if (nextStatus === 'confirmed') {
    const [assignedUser] = await db
      .select({ phone: users.phone, email: users.email })
      .from(users)
      .where(eq(users.id, tasting.assignedUserId))
      .limit(1)

    const [tastingDetails] = await db
      .select({
        eventName: tastings.eventName,
        scheduledAt: tastings.scheduledAt,
        endAt: tastings.endAt,
        storeAddress: tastings.storeAddress,
        storeCity: tastings.storeCity,
        storeState: tastings.storeState,
        storeZip: tastings.storeZip,
      })
      .from(tastings)
      .where(eq(tastings.id, tastingId))
      .limit(1)

    if (assignedUser?.phone && tastingDetails) {
      await sendTastingSmsFromTemplate({
        templateKey: 'confirmation_received',
        payload: formatTastingSmsPayload({
          tastingId,
          userId: tasting.assignedUserId,
          phoneNumber: assignedUser.phone,
          storeName: tastingDetails.eventName,
          storeAddress: [tastingDetails.storeAddress, tastingDetails.storeCity, tastingDetails.storeState, tastingDetails.storeZip].filter(Boolean).join(', ') || 'Store address not provided',
          scheduledAt: tastingDetails.scheduledAt,
          endAt: tastingDetails.endAt,
        }),
      }).catch(() => {})
    }

    if (assignedUser?.email && tastingDetails) {
      await sendTastingStatusEmail({
        to: assignedUser.email,
        storeName: tastingDetails.eventName,
        status: 'confirmed',
        scheduledAt: tastingDetails.scheduledAt,
      })
    }
  }

  if (nextStatus === 'declined') {
    await clearScheduledTastingSmsJobs(tastingId)

    await clearUserNotifications({
      userId: tasting.assignedUserId,
      href: `/taster/tastings/${tastingId}`,
      kinds: ['tasting_assigned', 'tasting_report_reminder'],
    })

    await notifyTeamAboutDeclinedTasting({
      tastingId,
      eventName: tasting.eventName,
      scheduledAt: tasting.scheduledAt,
      declinedByName: session.user.name || 'The assigned taster',
    })
  }

  if (nextStatus === 'completed') {
    await Promise.all([
      createNotificationsForRoles({
        roles: ['admin'],
        kind: 'tasting_completed',
        title: 'Tasting completed',
        body: 'A tasting has been marked complete.',
        href: '/admin/tastings',
      }),
      createNotificationsForRoles({
        roles: ['staff'],
        kind: 'tasting_completed',
        title: 'Tasting completed',
        body: 'A tasting has been marked complete.',
        href: '/staff/tastings',
      }),
    ])
  }

  revalidatePath('/admin/tastings')
  revalidatePath('/staff/tastings')
  revalidatePath('/taster/tastings')
  revalidatePath('/taster/payouts')
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
  await clearScheduledTastingSmsJobs(tasting.id)
  await logActivityEvent({
    entityType: 'tasting',
    entityId: tasting.id,
    actorUserId: session.user.id,
    relatedUserId: tasting.assignedUserId,
    kind: 'tasting_cancelled',
    title: 'Tasting removed',
    body: `${tasting.eventName} was cancelled.`,
  })

  await clearUserNotifications({
    userId: tasting.assignedUserId,
    href: `/taster/tastings/${tasting.id}`,
    kinds: ['tasting_assigned', 'tasting_report_reminder'],
  })

  await notifyTasterChange({
    recipientName: tasting.tasterName,
    recipientPhone: tasting.tasterPhone,
    actorId: session.user.id,
    body: `AHAWC Tasting Cancelled: ${tasting.eventName} on ${formatEasternDateTime(tasting.scheduledAt)} has been cancelled. Please check the portal for updates.`,
  })

  revalidatePath('/admin/tastings')
  revalidatePath('/staff/tastings')
  revalidatePath('/taster/tastings')
  revalidatePath('/taster/payouts')
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
      endAt: tastings.endAt,
      storeAddress: tastings.storeAddress,
      storeCity: tastings.storeCity,
      storeState: tastings.storeState,
      storeZip: tastings.storeZip,
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
    .select({ id: users.id, name: users.name, phone: users.phone, email: users.email, roles: users.roles })
    .from(users)
    .where(eq(users.id, nextAssignedUserId))
    .limit(1)

  if (!nextTaster || !nextTaster.roles.includes('taster')) {
    redirect(`${tastingRedirectPath(mode)}?error=${encodeURIComponent('Choose a valid taster account.')}`)
  }

  await db.update(tastings).set({
    assignedUserId: nextTaster.id,
  }).where(eq(tastings.id, tastingId))
  await logActivityEvent({
    entityType: 'tasting',
    entityId: tastingId,
    actorUserId: session.user.id,
    relatedUserId: nextTaster.id,
    kind: 'tasting_reassigned',
    title: 'Tasting reassigned',
    body: `${tasting.eventName} was reassigned to ${nextTaster.name}.`,
  })

  await clearScheduledTastingSmsJobs(tasting.id)

  await Promise.all([
    notifyTasterChange({
      recipientName: tasting.currentTasterName,
      recipientPhone: tasting.currentTasterPhone,
      actorId: session.user.id,
      body: `AHAWC Tasting Reassigned: ${tasting.eventName} on ${formatEasternDateTime(tasting.scheduledAt)} has been reassigned to another taster.`,
    }),
    notifyTasterChange({
      recipientName: nextTaster.name,
      recipientPhone: nextTaster.phone,
      actorId: session.user.id,
      body: `AHAWC Tasting Assigned: ${tasting.eventName} on ${formatEasternDateTime(tasting.scheduledAt)} has been assigned to you. View details: ${process.env.NEXTAUTH_URL}/taster/tastings`,
    }),
  ])

  await clearUserNotifications({
    userId: tasting.assignedUserId,
    href: `/taster/tastings/${tasting.id}`,
    kinds: ['tasting_assigned', 'tasting_report_reminder'],
  })

  await createUserNotification({
    userId: nextTaster.id,
    kind: 'tasting_assigned',
    title: 'Tasting reassigned to you',
    body: `${tasting.eventName} has been assigned to you for ${formatEasternDateTime(tasting.scheduledAt)}.`,
    href: `/taster/tastings/${tasting.id}`,
  })

  if (nextTaster.phone) {
    const payload = formatTastingSmsPayload({
      tastingId: tasting.id,
      userId: nextTaster.id,
      phoneNumber: nextTaster.phone,
      storeName: tasting.eventName,
      storeAddress: [tasting.storeAddress, tasting.storeCity, tasting.storeState, tasting.storeZip].filter(Boolean).join(', ') || 'Store address not provided',
      scheduledAt: tasting.scheduledAt,
      endAt: tasting.endAt,
    })

    await sendTastingSmsFromTemplate({
      templateKey: 'assignment',
      payload,
    }).catch(() => {})

    await queueScheduledTastingSmsJobs({
      ...payload,
      scheduledAt: tasting.scheduledAt,
      endAt: tasting.endAt,
    })
  }

  await createUserNotification({
    userId: nextTaster.id,
    kind: 'tasting_report_reminder',
    title: 'Complete your tasting report',
    body: `Submit your tasting report for ${tasting.eventName}.`,
    href: `/taster/tastings/${tasting.id}`,
    availableAt: new Date(tasting.scheduledAt.getTime() + 24 * 60 * 60 * 1000),
  })

  if (nextTaster.email) {
    await sendTasterAssignmentEmail({
      to: nextTaster.email,
      tasterName: nextTaster.name,
      storeName: tasting.eventName,
      scheduledAt: tasting.scheduledAt,
      endAt: tasting.endAt,
      notes: null,
    })
  }

  revalidatePath('/admin/tastings')
  revalidatePath('/staff/tastings')
  revalidatePath('/taster/tastings')
  revalidatePath('/taster/payouts')
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
  await logActivityEvent({
    entityType: 'tasting',
    entityId: tastingId,
    actorUserId: session.user.id,
    kind: 'tasting_report_submitted',
    title: 'Tasting report submitted',
    body: 'A tasting report was submitted for review.',
  })

  await clearUserNotifications({
    userId: tasting.assignedUserId,
    href: `/taster/tastings/${tastingId}`,
    kinds: ['tasting_report_reminder'],
  })

  const [tastingInfo] = await db
    .select({
      eventName: tastings.eventName,
      scheduledAt: tastings.scheduledAt,
      endAt: tastings.endAt,
      storeAddress: tastings.storeAddress,
      storeCity: tastings.storeCity,
      storeState: tastings.storeState,
      storeZip: tastings.storeZip,
    })
    .from(tastings)
    .where(eq(tastings.id, tastingId))
    .limit(1)

  const [assignedUser] = await db
    .select({ phone: users.phone, email: users.email, name: users.name })
    .from(users)
    .where(eq(users.id, tasting.assignedUserId))
    .limit(1)

  if (assignedUser?.phone && tastingInfo) {
    await sendTastingSmsFromTemplate({
      templateKey: 'report_received',
      payload: formatTastingSmsPayload({
        tastingId,
        userId: tasting.assignedUserId,
        phoneNumber: assignedUser.phone,
        storeName: tastingInfo.eventName,
        storeAddress: [tastingInfo.storeAddress, tastingInfo.storeCity, tastingInfo.storeState, tastingInfo.storeZip].filter(Boolean).join(', ') || 'Store address not provided',
        scheduledAt: tastingInfo.scheduledAt,
        endAt: tastingInfo.endAt,
      }),
    }).catch(() => {})
  }

  if (assignedUser?.email && tastingInfo) {
    await sendTastingReportReceivedEmail({
      to: assignedUser.email,
      tasterName: assignedUser.name,
      storeName: tastingInfo.eventName,
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
  const expenseAmount = (formData.get('expenseAmount') as string) || '0'
  const totalAmount = (formData.get('totalAmount') as string) || '0'

  const payload = {
    submittedByUserId: session.user.id,
    payeeName: (formData.get('payeeName') as string) || session.user.name || 'Taster',
    payeeEmail: (formData.get('payeeEmail') as string) || session.user.email || '',
    payeePhone: (formData.get('payeePhone') as string) || null,
    hourlyRate,
    hoursWorked,
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
  await logActivityEvent({
    entityType: 'tasting',
    entityId: tastingId,
    actorUserId: session.user.id,
    kind: 'taster_invoice_submitted',
    title: 'Taster invoice submitted',
    body: `Invoice submitted for $${totalAmount}.`,
  })

  await sendTasterInvoiceNotification({
    payeeName: payload.payeeName,
    payeeEmail: payload.payeeEmail,
    payeePhone: payload.payeePhone,
    tastingName: tasting.eventName,
    tastingDate: formatEasternDateTime(tasting.scheduledAt),
    storeAddress: [tasting.storeAddress, tasting.storeCity, tasting.storeState, tasting.storeZip].filter(Boolean).join(', '),
    hourlyRate,
    hoursWorked,
    expenseAmount,
    totalAmount,
    notes: payload.notes,
  })

  revalidatePath('/admin/tastings')
  revalidatePath('/staff/tastings')
  revalidatePath('/taster/tastings')
  revalidatePath('/taster/payouts')
  redirect(`/taster/tastings/${tastingId}?success=${encodeURIComponent('Invoice submitted to accounting.')}`)
}

export async function confirmTastingAssignment(tastingId: string) {
  const session = await requireFeature('tastings', 'taster', 'admin')
  const tasting = await getTastingById(tastingId)
  if (!tasting) redirect('/taster/tastings?error=Tasting%20not%20found.')
  if (!session.user.roles.includes('admin') && tasting.assignedUserId !== session.user.id) redirect('/unauthorized')

  const formData = new FormData()
  formData.set('tastingId', tastingId)
  formData.set('status', 'confirmed')
  formData.set('mode', 'taster')
  await updateTastingStatus(formData)
}

export async function declineTastingAssignment(tastingId: string) {
  const session = await requireFeature('tastings', 'taster', 'admin')
  const tasting = await getTastingById(tastingId)
  if (!tasting) redirect('/taster/tastings?error=Tasting%20not%20found.')
  if (!session.user.roles.includes('admin') && tasting.assignedUserId !== session.user.id) redirect('/unauthorized')

  const formData = new FormData()
  formData.set('tastingId', tastingId)
  formData.set('status', 'declined')
  formData.set('mode', 'taster')
  await updateTastingStatus(formData)
}

export async function checkInToTasting(tastingId: string) {
  const session = await requireFeature('tastings', 'taster', 'admin')
  const tasting = await getTastingById(tastingId)
  if (!tasting) redirect('/taster/tastings?error=Tasting%20not%20found.')
  if (!session.user.roles.includes('admin') && tasting.assignedUserId !== session.user.id) redirect('/unauthorized')

  await db.update(tastings).set({ checkedInAt: new Date(), status: tasting.status === 'scheduled' ? 'confirmed' : tasting.status }).where(eq(tastings.id, tastingId))
  await logActivityEvent({
    entityType: 'tasting',
    entityId: tastingId,
    actorUserId: session.user.id,
    kind: 'tasting_checked_in',
    title: 'Taster checked in',
    body: 'Check-in recorded from the tasting portal.',
  })
  revalidatePath('/taster/tastings')
  redirect(`/taster/tastings/${tastingId}?success=${encodeURIComponent('Check-in recorded.')}`)
}

export async function getTastingsForView({
  assignedUserId,
}: {
  assignedUserId?: string
}) {
  return getTastingsForViewWithFallback({ assignedUserId })
}
