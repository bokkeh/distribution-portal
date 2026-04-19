'use server'

import { and, eq, gte, lte } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import { customerAccounts, salesMembers, tasterAvailability, tasterInvoices, tastingReports, tastings, users } from '@/db/schema'
import { requireFeature, requireRole } from '@/lib/auth/session'
import { notify } from '@/lib/notifications/dispatch'
import { sendTasterInvoiceNotification } from '@/lib/resend/client'
import { clearUserNotifications, createNotificationsForRoles } from '@/lib/notifications/in-app'
import { sendSms } from '@/lib/telnyx/client'
import { postGoogleChat } from '@/lib/google-chat/webhook'
import {
  clearScheduledTastingSmsJobs,
  formatTastingSmsPayload,
  queueScheduledTastingSmsJobs,
  sendTastingSmsFromTemplate,
} from '@/lib/tastings/sms-series'
import { getTastingById, getTastingsForViewWithFallback } from '@/lib/tastings/read'
import { formatEasternDateTime, parseDateTimeInTimeZone } from '@/lib/tastings/time'
import { logActivityEvent } from '@/lib/activity/log'
import { getStaffEmailsForNotification } from '@/lib/notifications/recipients'
import { getUserPreferences } from '@/lib/preferences/read'

function tastingRedirectPath(mode: string) {
  return mode === 'staff' ? '/staff/tastings' : '/admin/tastings'
}

type TastingStatus = 'requested' | 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'declined'

const DEFAULT_TASTING_DURATION_MS = 2 * 60 * 60 * 1000
const BOOKED_TASTING_STATUSES = new Set<TastingStatus>(['scheduled', 'confirmed'])
const ACTIVE_TASTING_STATUSES = new Set<TastingStatus>(['requested', 'scheduled', 'confirmed'])
const TERMINAL_TASTING_STATUSES = new Set<TastingStatus>(['completed', 'cancelled', 'declined'])
const ALLOWED_TASTING_TRANSITIONS: Record<TastingStatus, TastingStatus[]> = {
  requested: ['scheduled', 'cancelled'],
  scheduled: ['confirmed', 'cancelled', 'declined'],
  confirmed: ['completed', 'cancelled', 'declined'],
  completed: [],
  cancelled: [],
  declined: [],
}

function getTastingEndTime(start: Date, end: Date | null) {
  return end ?? new Date(start.getTime() + DEFAULT_TASTING_DURATION_MS)
}

function rangesOverlap(startA: Date, endA: Date, startB: Date, endB: Date) {
  return startA < endB && startB < endA
}

function getEasternDateKey(value: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value)
}

function isMissingTrainingDayColumn(error: unknown) {
  const code = (error as { code?: string; cause?: { code?: string } } | null)?.code
    ?? (error as { cause?: { code?: string } } | null)?.cause?.code
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()

  return code === '42703' || message.includes('training_day')
}

function isMissingTastingSchedulingColumn(error: unknown) {
  const code = (error as { code?: string; cause?: { code?: string } } | null)?.code
    ?? (error as { cause?: { code?: string } } | null)?.cause?.code
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()

  return code === '42703'
    || message.includes('training_day')
    || message.includes('end_at')
    || message.includes('checked_in_at')
    || message.includes('status')
}

function isMissingTasterAvailabilityTable(error: unknown) {
  const code = (error as { code?: string; cause?: { code?: string } } | null)?.code
    ?? (error as { cause?: { code?: string } } | null)?.cause?.code
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()

  return code === '42p01' || message.includes('taster_availability')
}

function parseNonNegativeDecimalField(
  value: FormDataEntryValue | null,
  fieldLabel: string,
  maxValue?: number,
): { ok: false; error: string } | { ok: true; numericValue: number; formattedValue: string } {
  const rawValue = String(value ?? '').trim()
  const parsedValue = Number(rawValue || '0')

  if (!Number.isFinite(parsedValue)) {
    return { ok: false, error: `Enter a valid ${fieldLabel.toLowerCase()}.` }
  }

  if (parsedValue < 0) {
    return { ok: false, error: `${fieldLabel} cannot be negative.` }
  }

  if (maxValue != null && parsedValue > maxValue) {
    return { ok: false, error: `${fieldLabel} looks too high. Please review it and try again.` }
  }

  return {
    ok: true,
    numericValue: parsedValue,
    formattedValue: parsedValue.toFixed(2),
  }
}

async function getSalesMemberIdForUser(userId: string) {
  const [member] = await db
    .select({ id: salesMembers.id, status: salesMembers.status })
    .from(salesMembers)
    .where(eq(salesMembers.userId, userId))
    .limit(1)

  if (!member || member.status !== 'active') {
    return null
  }

  return member.id
}

async function insertTastingWithFallback(input: {
  customerId: string
  assignedUserId: string
  createdByUserId: string
  eventName: string
  scheduledAt: Date
  endAt?: Date | null
  status?: TastingStatus
  storeAddress?: string | null
  storeCity?: string | null
  storeState?: string | null
  storeZip?: string | null
  storePhone?: string | null
  trainingDay?: boolean
  notes?: string | null
}) {
  const fullValues = {
    customerId: input.customerId,
    assignedUserId: input.assignedUserId,
    createdByUserId: input.createdByUserId,
    eventName: input.eventName,
    scheduledAt: input.scheduledAt,
    endAt: input.endAt ?? null,
    status: input.status ?? 'scheduled',
    storeAddress: input.storeAddress ?? null,
    storeCity: input.storeCity ?? null,
    storeState: input.storeState ?? null,
    storeZip: input.storeZip ?? null,
    storePhone: input.storePhone ?? null,
    trainingDay: input.trainingDay ?? false,
    notes: input.notes ?? null,
  }

  try {
    const [tasting] = await db.insert(tastings).values(fullValues).returning({ id: tastings.id })
    return tasting
  } catch (error) {
    if (!isMissingTastingSchedulingColumn(error)) throw error

    const legacyValues = {
      customerId: input.customerId,
      assignedUserId: input.assignedUserId,
      createdByUserId: input.createdByUserId,
      eventName: input.eventName,
      scheduledAt: input.scheduledAt,
      storeAddress: input.storeAddress ?? null,
      storeCity: input.storeCity ?? null,
      storeState: input.storeState ?? null,
      storeZip: input.storeZip ?? null,
      storePhone: input.storePhone ?? null,
      notes: input.notes ?? null,
    }

    const [tasting] = await db.insert(tastings).values(legacyValues).returning({ id: tastings.id })
    return tasting
  }
}

async function validateTastingWindow({
  customerId,
  assignedUserId,
  scheduledAt,
  endAt,
  trainingDay,
  excludeTastingId,
}: {
  customerId: string
  assignedUserId: string
  scheduledAt: Date
  endAt: Date | null
  trainingDay?: boolean
  excludeTastingId?: string
}) {
  const requestedDateKey = getEasternDateKey(scheduledAt)
  const monthStart = `${requestedDateKey.slice(0, 7)}-01`
  const monthEnd = `${requestedDateKey.slice(0, 7)}-31`
  const requestedEnd = getTastingEndTime(scheduledAt, endAt)

  const [availabilityRows, assignedTastings, accountTastings] = await Promise.all([
    db
      .select({ availableDate: tasterAvailability.availableDate })
      .from(tasterAvailability)
      .where(and(
        eq(tasterAvailability.userId, assignedUserId),
        gte(tasterAvailability.availableDate, monthStart),
        lte(tasterAvailability.availableDate, monthEnd),
      ))
      .catch((error) => {
        if (!isMissingTasterAvailabilityTable(error)) throw error
        return []
      }),
    db
      .select({
        id: tastings.id,
        scheduledAt: tastings.scheduledAt,
        endAt: tastings.endAt,
        status: tastings.status,
      })
      .from(tastings)
      .where(eq(tastings.assignedUserId, assignedUserId))
      .catch(async (error) => {
        if (!isMissingTastingSchedulingColumn(error)) throw error

        const rows = await db
          .select({
            id: tastings.id,
            scheduledAt: tastings.scheduledAt,
            status: tastings.status,
          })
          .from(tastings)
          .where(eq(tastings.assignedUserId, assignedUserId))

        return rows.map((row) => ({ ...row, endAt: null }))
      }),
    db
      .select({
        id: tastings.id,
        scheduledAt: tastings.scheduledAt,
        trainingDay: tastings.trainingDay,
        status: tastings.status,
      })
      .from(tastings)
      .where(eq(tastings.customerId, customerId))
      .catch(async (error) => {
        if (!isMissingTastingSchedulingColumn(error)) throw error

        const rows = await db
          .select({
            id: tastings.id,
            scheduledAt: tastings.scheduledAt,
            status: tastings.status,
          })
          .from(tastings)
          .where(eq(tastings.customerId, customerId))

        return rows.map((row) => ({ ...row, trainingDay: false }))
      }),
  ])

  if (availabilityRows.length > 0 && !availabilityRows.some((row) => row.availableDate === requestedDateKey)) {
    return 'That taster has not marked themselves available on the selected date.'
  }

  for (const tasting of assignedTastings) {
    if (tasting.id === excludeTastingId) continue
    if (!BOOKED_TASTING_STATUSES.has((tasting.status as TastingStatus) ?? 'scheduled')) continue

    const existingStart = new Date(tasting.scheduledAt)
    if (getEasternDateKey(existingStart) !== requestedDateKey) continue

    const existingEnd = getTastingEndTime(existingStart, tasting.endAt ? new Date(tasting.endAt) : null)
    if (rangesOverlap(scheduledAt, requestedEnd, existingStart, existingEnd)) {
      return 'That taster is already booked during the selected time window.'
    }
  }

  const activeSameDayAccountTastings = accountTastings.filter((tasting) => {
    if (tasting.id === excludeTastingId) return false
    if (!ACTIVE_TASTING_STATUSES.has((tasting.status as TastingStatus) ?? 'scheduled')) return false
    return getEasternDateKey(new Date(tasting.scheduledAt)) === requestedDateKey
  })

  if (activeSameDayAccountTastings.length > 0) {
    const existingTrainingDay = activeSameDayAccountTastings.some((tasting) => tasting.trainingDay)
    if (activeSameDayAccountTastings.length >= 2 || (!trainingDay && !existingTrainingDay)) {
      return 'This account already has an active tasting or request on that date.'
    }
  }

  return null
}


export async function createTasting(formData: FormData) {
  const session = await requireFeature('tastings', 'admin', 'staff')
  const mode = (formData.get('mode') as string) || 'admin'
  const customerId = formData.get('customerId') as string
  const assignedUserId = formData.get('assignedUserId') as string
  const date = formData.get('date') as string
  const time = ((formData.get('time') as string) || '17:00').trim()
  const endTime = ((formData.get('endTime') as string) || '').trim()
  const trainingDay = formData.get('trainingDay') === 'on'
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
    .select({ id: users.id, name: users.name, phone: users.phone, email: users.email, roles: users.roles, active: users.active })
    .from(users)
    .where(eq(users.id, assignedUserId))
    .limit(1)

  if (!assignedUser || !assignedUser.active || !assignedUser.roles.includes('taster')) {
    redirect(`${tastingRedirectPath(mode)}?error=${encodeURIComponent('Choose a valid taster account.')}`)
  }

  const schedulingError = await validateTastingWindow({
    customerId: account.id,
    assignedUserId: assignedUser.id,
    scheduledAt,
    endAt,
    trainingDay,
  })
  if (schedulingError) {
    redirect(`${tastingRedirectPath(mode)}?error=${encodeURIComponent(schedulingError)}`)
  }
  const assignedUserPrefs = await getUserPreferences(assignedUser.id).catch(() => null)

  const tasting = await insertTastingWithFallback({
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
    trainingDay,
    notes,
  })

  const storeAddress = [account.address, account.city, account.state, account.zip].filter(Boolean).join(', ') || 'Store address not provided'

  if (assignedUser.phone && (assignedUserPrefs?.smsNotificationsEnabled ?? true)) {
    try {
      await queueScheduledTastingSmsJobs({
        ...formatTastingSmsPayload({
          tastingId: tasting.id,
          userId: assignedUser.id,
          phoneNumber: assignedUser.phone,
          storeName: account.companyName,
          storeAddress,
          scheduledAt,
          endAt,
        }),
        scheduledAt,
        endAt,
      })
    } catch (error) {
      console.error('Failed to queue tasting SMS jobs:', error)
    }
  }

  await notify('tasting.taster_assigned', {
    tasterName: assignedUser.name,
    tasterEmail: (assignedUserPrefs?.emailNotificationsEnabled ?? true) ? (assignedUser.email ?? '') : '',
    tasterPhone: (assignedUserPrefs?.smsNotificationsEnabled ?? true) ? assignedUser.phone : null,
    storeName: account.companyName,
    storeAddress,
    scheduledAt,
    endAt,
    notes,
    tastingId: tasting.id,
    userId: (assignedUserPrefs?.inAppNotificationsEnabled ?? true) ? assignedUser.id : null,
  })

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
  const nextStatus = formData.get('status') as TastingStatus
  const mode = (formData.get('mode') as string) || 'taster'

  const [tasting] = await db
    .select({
      id: tastings.id,
      assignedUserId: tastings.assignedUserId,
      eventName: tastings.eventName,
      scheduledAt: tastings.scheduledAt,
      status: tastings.status,
      checkedInAt: tastings.checkedInAt,
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

  const currentStatus = tasting.status as TastingStatus
  if (!ALLOWED_TASTING_TRANSITIONS[currentStatus]?.includes(nextStatus)) {
    redirect(`/${mode}/tastings?error=${encodeURIComponent(`Cannot change a ${currentStatus} tasting to ${nextStatus}.`)}`)
  }

  if (nextStatus === 'completed') {
    const reportExists = await db
      .select({ id: tastingReports.id })
      .from(tastingReports)
      .where(eq(tastingReports.tastingId, tastingId))
      .limit(1)
      .then((rows) => rows[0] ?? null)

    if (!tasting.checkedInAt && !reportExists) {
      redirect(`/${mode}/tastings?error=${encodeURIComponent('Complete the tasting after check-in or after a report has been submitted.')}`)
    }

    if (new Date(tasting.scheduledAt).getTime() > Date.now() + (15 * 60 * 1000)) {
      redirect(`/${mode}/tastings?error=${encodeURIComponent('You cannot complete a tasting before its scheduled start time.')}`)
    }
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

    if (tastingDetails) {
      const storeAddress = [tastingDetails.storeAddress, tastingDetails.storeCity, tastingDetails.storeState, tastingDetails.storeZip].filter(Boolean).join(', ') || 'Store address not provided'
      await notify('tasting.status_changed', {
        tasterEmail: assignedUser?.email ?? '',
        tasterPhone: assignedUser?.phone ?? null,
        storeName: tastingDetails.eventName,
        storeAddress,
        status: 'confirmed',
        scheduledAt: tastingDetails.scheduledAt,
        endAt: tastingDetails.endAt,
        tastingId,
        userId: tasting.assignedUserId,
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

    const teamMembers = await db
      .select({ id: users.id, phone: users.phone, email: users.email, roles: users.roles, active: users.active })
      .from(users)

    const teamPhones: Array<{ phone: string; userId: string }> = []
    const teamEmails: string[] = []
    for (const member of teamMembers) {
      if (!member.active) continue
      if (!member.roles.includes('staff') && !member.roles.includes('admin')) continue
      if (member.phone) teamPhones.push({ phone: member.phone, userId: member.id })
      if (member.email) teamEmails.push(member.email)
    }

    await notify('tasting.taster_declined', {
      tastingId,
      eventName: tasting.eventName,
      scheduledAt: tasting.scheduledAt,
      declinedByName: session.user.name || 'The assigned taster',
      teamPhones,
      teamEmails,
    })

    await logActivityEvent({
      entityType: 'tasting',
      entityId: tastingId,
      kind: 'tasting_declined_notified',
      title: 'Team notified of decline',
      body: `${session.user.name || 'The assigned taster'} declined ${tasting.eventName} and the team was notified.`,
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
  revalidatePath(`/admin/tastings/${tastingId}`)

  const redirectTo = formData.get('redirectTo') as string | null
  if (redirectTo?.startsWith('/')) {
    redirect(`${redirectTo}?success=${encodeURIComponent('Tasting updated.')}`)
  }
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
      status: tastings.status,
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

  if (TERMINAL_TASTING_STATUSES.has(tasting.status as TastingStatus) && tasting.status !== 'declined') {
    redirect(`${tastingRedirectPath(mode)}?success=${encodeURIComponent('That tasting is already closed.')}`)
  }

  await db.update(tastings).set({ status: 'cancelled' }).where(eq(tastings.id, tastingId))
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

  await notify('tasting.status_changed', {
    tasterEmail: '',
    tasterPhone: tasting.tasterPhone,
    storeName: tasting.eventName,
    status: 'cancelled',
    scheduledAt: tasting.scheduledAt,
    tastingId: tasting.id,
    userId: null,
  })

  revalidatePath('/admin/tastings')
  revalidatePath('/staff/tastings')
  revalidatePath('/taster/tastings')
  revalidatePath('/taster/payouts')
  redirect(`${tastingRedirectPath(mode)}?success=${encodeURIComponent('Tasting cancelled and preserved in history.')}`)
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
      trainingDay: tastings.trainingDay,
      customerId: tastings.customerId,
      assignedUserId: tastings.assignedUserId,
      status: tastings.status,
      currentTasterName: users.name,
      currentTasterPhone: users.phone,
    })
    .from(tastings)
    .innerJoin(users, eq(tastings.assignedUserId, users.id))
    .where(eq(tastings.id, tastingId))
    .limit(1)
    .catch(async (error) => {
      if (!isMissingTrainingDayColumn(error)) throw error

      const rows = await db
        .select({
          id: tastings.id,
          eventName: tastings.eventName,
          scheduledAt: tastings.scheduledAt,
          endAt: tastings.endAt,
          storeAddress: tastings.storeAddress,
          storeCity: tastings.storeCity,
          storeState: tastings.storeState,
          storeZip: tastings.storeZip,
          customerId: tastings.customerId,
          assignedUserId: tastings.assignedUserId,
          status: tastings.status,
          currentTasterName: users.name,
          currentTasterPhone: users.phone,
        })
        .from(tastings)
        .innerJoin(users, eq(tastings.assignedUserId, users.id))
        .where(eq(tastings.id, tastingId))
        .limit(1)

      return rows.map((row) => ({ ...row, trainingDay: false }))
    })

  if (!tasting) {
    redirect(`${tastingRedirectPath(mode)}?error=${encodeURIComponent('Tasting not found.')}`)
  }

  if (tasting.assignedUserId === nextAssignedUserId) {
    redirect(`${tastingRedirectPath(mode)}?success=${encodeURIComponent('Tasting already assigned to that taster.')}`)
  }

  if (TERMINAL_TASTING_STATUSES.has(tasting.status as TastingStatus)) {
    redirect(`${tastingRedirectPath(mode)}?error=${encodeURIComponent('Closed tastings cannot be reassigned.')}`)
  }

  const [nextTaster] = await db
    .select({ id: users.id, name: users.name, phone: users.phone, email: users.email, roles: users.roles, active: users.active })
    .from(users)
    .where(eq(users.id, nextAssignedUserId))
    .limit(1)

  if (!nextTaster || !nextTaster.active || !nextTaster.roles.includes('taster')) {
    redirect(`${tastingRedirectPath(mode)}?error=${encodeURIComponent('Choose a valid taster account.')}`)
  }

  const reassignmentError = await validateTastingWindow({
    customerId: tasting.customerId,
    assignedUserId: nextTaster.id,
    scheduledAt: new Date(tasting.scheduledAt),
    endAt: tasting.endAt ? new Date(tasting.endAt) : null,
    trainingDay: tasting.trainingDay,
    excludeTastingId: tastingId,
  })
  if (reassignmentError) {
    redirect(`${tastingRedirectPath(mode)}?error=${encodeURIComponent(reassignmentError)}`)
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

  // Notify previous taster of reassignment (plain SMS only — no email/in-app)
  if (tasting.currentTasterPhone) {
    await notify('tasting.status_changed', {
      tasterEmail: '',
      tasterPhone: tasting.currentTasterPhone,
      storeName: tasting.eventName,
      status: 'cancelled',
      scheduledAt: tasting.scheduledAt,
      tastingId: tasting.id,
      userId: null,
    })
  }

  await clearUserNotifications({
    userId: tasting.assignedUserId,
    href: `/taster/tastings/${tasting.id}`,
    kinds: ['tasting_assigned', 'tasting_report_reminder'],
  })

  const storeAddress = [tasting.storeAddress, tasting.storeCity, tasting.storeState, tasting.storeZip].filter(Boolean).join(', ') || 'Store address not provided'

  if (nextTaster.phone) {
    await queueScheduledTastingSmsJobs({
      ...formatTastingSmsPayload({
        tastingId: tasting.id,
        userId: nextTaster.id,
        phoneNumber: nextTaster.phone,
        storeName: tasting.eventName,
        storeAddress,
        scheduledAt: tasting.scheduledAt,
        endAt: tasting.endAt,
      }),
      scheduledAt: tasting.scheduledAt,
      endAt: tasting.endAt,
    })
  }

  await notify('tasting.taster_assigned', {
    tasterName: nextTaster.name,
    tasterEmail: nextTaster.email ?? '',
    tasterPhone: nextTaster.phone,
    storeName: tasting.eventName,
    storeAddress,
    scheduledAt: tasting.scheduledAt,
    endAt: tasting.endAt,
    notes: null,
    tastingId: tasting.id,
    userId: nextTaster.id,
  })

  revalidatePath('/admin/tastings')
  revalidatePath('/staff/tastings')
  revalidatePath('/taster/tastings')
  revalidatePath('/taster/payouts')
  revalidatePath(`/admin/tastings/${tastingId}`)

  const redirectTo = formData.get('redirectTo') as string | null
  if (redirectTo?.startsWith('/')) {
    redirect(`${redirectTo}?success=${encodeURIComponent('Tasting reassigned and tasters notified.')}`)
  }
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

  let shelfPhotoUrls: string[] = []
  try {
    const raw = (formData.get('shelfPhotoUrls') as string) || '[]'
    shelfPhotoUrls = JSON.parse(raw).filter(Boolean)
  } catch { /* ignore parse errors */ }

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
    setupPhotoUrl: ((formData.get('setupPhotoUrl') as string) || '').trim() || null,
    shelfPhotoUrls,
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

  if (tastingInfo) {
    await notify('tasting.report_received', {
      tasterName: assignedUser?.name ?? '',
      tasterEmail: assignedUser?.email ?? '',
      storeName: tastingInfo.eventName,
      tastingId,
      userId: tasting.assignedUserId,
    })
  }

  if (payload.followUpNeeded) {
    await createNotificationsForRoles({
      roles: ['admin', 'staff'],
      kind: 'tasting_follow_up_needed',
      title: `Follow-up needed - ${tastingInfo?.eventName ?? 'Tasting'}`,
      body: payload.followUpNotes?.trim() || 'A submitted tasting report requires staff follow-up.',
      href: `/admin/tastings/${tastingId}`,
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
      status: tastings.status,
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

  const hoursWorkedResult = parseNonNegativeDecimalField(formData.get('hoursWorked'), 'Hours worked', 24)
  if (!hoursWorkedResult.ok) {
    redirect(`/taster/tastings/${tastingId}?error=${encodeURIComponent(hoursWorkedResult.error)}`)
  }

  const expenseAmountResult = parseNonNegativeDecimalField(formData.get('expenseAmount'), 'Expense amount', 10000)
  if (!expenseAmountResult.ok) {
    redirect(`/taster/tastings/${tastingId}?error=${encodeURIComponent(expenseAmountResult.error)}`)
  }

  if (hoursWorkedResult.numericValue === 0 && expenseAmountResult.numericValue === 0) {
    redirect(`/taster/tastings/${tastingId}?error=${encodeURIComponent('Enter hours worked or reimbursable expenses before submitting the invoice.')}`)
  }

  const receiptUrls = Array.from(
    new Set(
      formData
        .getAll('receiptUrls')
        .map((value) => String(value || '').trim())
        .filter(Boolean),
    ),
  )

  const [report] = await db
    .select({ id: tastingReports.id })
    .from(tastingReports)
    .where(eq(tastingReports.tastingId, tastingId))
    .limit(1)

  if (!report) {
    redirect(`/taster/tastings/${tastingId}?error=${encodeURIComponent('Submit the tasting report before invoicing accounting.')}`)
  }

  if (tasting.status === 'requested' || tasting.status === 'cancelled' || tasting.status === 'declined') {
    redirect(`/taster/tastings/${tastingId}?error=${encodeURIComponent('Invoice submission is not available for the current tasting status.')}`)
  }

  if (tasting.status !== 'completed') {
    if (new Date(tasting.scheduledAt).getTime() > Date.now() + (15 * 60 * 1000)) {
      redirect(`/taster/tastings/${tastingId}?error=${encodeURIComponent('You cannot submit an invoice before the tasting start time.')}`)
    }

    await db.update(tastings).set({ status: 'completed' }).where(eq(tastings.id, tastingId))
    await logActivityEvent({
      entityType: 'tasting',
      entityId: tastingId,
      actorUserId: session.user.id,
      kind: 'tasting_status_changed',
      title: 'Tasting status updated',
      body: 'Status changed to completed.',
    })
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

  // Fetch admin-set hourly rate from user record
  const [tasterUser] = await db
    .select({ tasterHourlyRate: users.tasterHourlyRate })
    .from(users)
    .where(eq(users.id, tasting.assignedUserId ?? session.user.id))
    .limit(1)
  const hourlyRateNumber = Number(tasterUser?.tasterHourlyRate ?? '25')
  const hourlyRate = Number.isFinite(hourlyRateNumber) && hourlyRateNumber >= 0 ? hourlyRateNumber.toFixed(2) : '25.00'
  const totalAmount = ((Number(hourlyRate) * hoursWorkedResult.numericValue) + expenseAmountResult.numericValue).toFixed(2)
  const invoiceOwnerUserId = tasting.assignedUserId ?? session.user.id

  const payload = {
    submittedByUserId: invoiceOwnerUserId,
    payeeName: (formData.get('payeeName') as string) || session.user.name || 'Taster',
    payeeEmail: (formData.get('payeeEmail') as string) || session.user.email || '',
    payeePhone: (formData.get('payeePhone') as string) || null,
    hourlyRate,
    hoursWorked: hoursWorkedResult.formattedValue,
    mileage: '0',
    expenseAmount: expenseAmountResult.formattedValue,
    totalAmount,
    receiptUrls,
    notes: ((formData.get('notes') as string) || '').trim() || null,
    status: 'submitted' as const,
  }

  const [existing] = await db
    .select({ id: tasterInvoices.id, status: tasterInvoices.status })
    .from(tasterInvoices)
    .where(eq(tasterInvoices.tastingId, tastingId))
    .limit(1)

  if (existing && (existing.status === 'approved' || existing.status === 'paid')) {
    redirect(`/taster/tastings/${tastingId}?error=${encodeURIComponent(`This invoice has already been ${existing.status} and can no longer be edited.`)}`)
  }

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

  const adminEmails = await getStaffEmailsForNotification(['admin']).catch(() => [])
  const invoiceRecipients = Array.from(
    new Set([
      ...adminEmails,
      (process.env.TASTER_ACCOUNTING_EMAIL ?? '').trim(),
      (process.env.ORDER_NOTIFY_KRISTEN_EMAIL ?? '').trim(),
    ].filter(Boolean)),
  )

  await sendTasterInvoiceNotification({
    to: invoiceRecipients,
    payeeName: payload.payeeName,
    payeeEmail: payload.payeeEmail,
    payeePhone: payload.payeePhone,
    tastingName: tasting.eventName,
    tastingDate: formatEasternDateTime(tasting.scheduledAt),
    storeAddress: [tasting.storeAddress, tasting.storeCity, tasting.storeState, tasting.storeZip].filter(Boolean).join(', '),
    hourlyRate,
    hoursWorked: hoursWorkedResult.formattedValue,
    expenseAmount: expenseAmountResult.formattedValue,
    totalAmount,
    receiptUrls,
    notes: payload.notes,
  })

  revalidatePath('/admin/tastings')
  revalidatePath('/admin/invoicing')
  revalidatePath('/staff/tastings')
  revalidatePath('/staff/invoicing')
  revalidatePath('/taster/tastings')
  revalidatePath('/taster/payouts')
  revalidatePath(`/taster/tastings/${tastingId}`)
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

  if (tasting.status === 'requested' || tasting.status === 'cancelled' || tasting.status === 'declined' || tasting.status === 'completed') {
    redirect(`/taster/tastings/${tastingId}?error=${encodeURIComponent('Check-in is not available for the current tasting status.')}`)
  }

  const now = Date.now()
  const scheduledStart = new Date(tasting.scheduledAt).getTime()
  if (now < scheduledStart - (12 * 60 * 60 * 1000)) {
    redirect(`/taster/tastings/${tastingId}?error=${encodeURIComponent('Check-in opens 12 hours before the tasting start time.')}`)
  }

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

// ─── Scheduling Assistant ─────────────────────────────────────────────────────

export type TastingSuggestion = {
  date: string           // ISO date string (YYYY-MM-DD)
  dayLabel: string       // e.g. "Tuesday, Jan 14"
  availableTasters: Array<{ id: string; name: string }>
  conflictCount: number  // existing tastings that day across all accounts
}

/**
 * Suggests up to 5 optimal tasting slots for a given account over the next 45 days.
 * Prefers weekdays with fewer existing tastings and available tasters.
 */
export async function getTastingScheduleSuggestions(
  accountId: string,
): Promise<{ suggestions: TastingSuggestion[]; error?: string }> {
  await requireFeature('tastings', 'admin')

  // All tastings in next 45 days (to detect conflicts)
  const now = new Date()
  const end45 = new Date(now)
  end45.setDate(end45.getDate() + 45)

  const upcoming = await db
    .select({ scheduledAt: tastings.scheduledAt, assignedUserId: tastings.assignedUserId, customerId: tastings.customerId })
    .from(tastings)
    .where(
      eq(tastings.status, 'scheduled'),
    )

  // Busiest days (count of tastings per day)
  const tastingsByDay = new Map<string, number>()
  const accountTastingDays = new Set<string>()
  for (const t of upcoming) {
    const d = new Date(t.scheduledAt)
    if (d < now || d > end45) continue
    const key = d.toISOString().slice(0, 10)
    tastingsByDay.set(key, (tastingsByDay.get(key) ?? 0) + 1)
    if (t.customerId === accountId) accountTastingDays.add(key)
  }

  // Active tasters
  const tasterRows = await db
    .select({ id: users.id, name: users.name, roles: users.roles, active: users.active })
    .from(users)
    .where(eq(users.active, true))

  const tasters = tasterRows.filter(u => u.roles?.includes('taster'))

  // Tasters already booked per day
  const tasterBookedByDay = new Map<string, Set<string>>()
  for (const t of upcoming) {
    const d = new Date(t.scheduledAt)
    if (d < now || d > end45) continue
    const key = d.toISOString().slice(0, 10)
    if (!tasterBookedByDay.has(key)) tasterBookedByDay.set(key, new Set())
    if (t.assignedUserId) tasterBookedByDay.get(key)!.add(t.assignedUserId)
  }

  const suggestions: TastingSuggestion[] = []

  for (let daysOut = 3; daysOut <= 45 && suggestions.length < 5; daysOut++) {
    const d = new Date(now)
    d.setDate(d.getDate() + daysOut)
    const dayOfWeek = d.getDay()
    if (dayOfWeek === 0 || dayOfWeek === 6) continue // skip weekends

    const dateKey = d.toISOString().slice(0, 10)
    if (accountTastingDays.has(dateKey)) continue // already has tasting this day

    const bookedTasters = tasterBookedByDay.get(dateKey) ?? new Set<string>()
    const availableTasters = tasters.filter(t => !bookedTasters.has(t.id))

    if (availableTasters.length === 0) continue

    suggestions.push({
      date: dateKey,
      dayLabel: d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }),
      availableTasters: availableTasters.map(t => ({ id: t.id, name: t.name ?? 'Unknown' })),
      conflictCount: tastingsByDay.get(dateKey) ?? 0,
    })
  }

  return { suggestions }
}

export async function requestTastingFromRep({
  accountId,
  preferredDate,
  preferredTime,
  notes,
}: {
  accountId: string
  preferredDate: string
  preferredTime: string
  notes?: string
}): Promise<{ success?: boolean; error?: string }> {
  const session = await requireRole('sales_rep', 'sales_manager', 'admin')

  if (!accountId || !preferredDate || !preferredTime) {
    return { error: 'Account, date and time are required' }
  }

  const roles = session.user.roles ?? [session.user.role]
  const isAdmin = roles.includes('admin')
  const isSalesManager = roles.includes('sales_manager')

  let memberId: string | null = null
  if (!isAdmin && !isSalesManager) {
    memberId = await getSalesMemberIdForUser(session.user.id)
    if (!memberId) {
      return { error: 'Your sales member profile is not active yet.' }
    }
  }

  // Verify this account belongs to the requesting rep (unless admin/sales manager)
  const [account] = await db
    .select({
      id: customerAccounts.id,
      companyName: customerAccounts.companyName,
      address: customerAccounts.address,
      city: customerAccounts.city,
      state: customerAccounts.state,
      zip: customerAccounts.zip,
      phone: customerAccounts.phone,
      assignedSalesRepId: customerAccounts.assignedSalesRepId,
    })
    .from(customerAccounts)
    .where(eq(customerAccounts.id, accountId))
    .limit(1)

  if (!account) return { error: 'Account not found' }
  if (!isAdmin && !isSalesManager && account.assignedSalesRepId !== memberId) {
    return { error: 'You can only request tastings for accounts assigned to you.' }
  }

  // Find any available taster to assign (required field — pick first available or fall back to requester)
  const scheduledAt = parseDateTimeInTimeZone(preferredDate, preferredTime)
  if (Number.isNaN(scheduledAt.getTime())) {
    return { error: 'Choose a valid tasting date and time.' }
  }

  const requestedDateKey = getEasternDateKey(scheduledAt)
  const accountTastings = await db
    .select({ scheduledAt: tastings.scheduledAt, status: tastings.status })
    .from(tastings)
    .where(eq(tastings.customerId, accountId))

  if (accountTastings.some((tasting) =>
    ACTIVE_TASTING_STATUSES.has((tasting.status as TastingStatus) ?? 'requested')
    && getEasternDateKey(new Date(tasting.scheduledAt)) === requestedDateKey
  )) {
    return { error: 'This account already has an active tasting or request on that date.' }
  }

  const tasterRows = await db
    .select({ id: users.id, roles: users.roles })
    .from(users)
    .where(eq(users.active, true))

  const placeholderTaster = tasterRows.find((user) => user.roles?.includes('taster'))
  if (!placeholderTaster) {
    return { error: 'No tasters are currently configured. Ask an admin to add a taster before requesting a tasting.' }
  }

  const created = await insertTastingWithFallback({
    customerId: accountId,
    assignedUserId: placeholderTaster.id,
    createdByUserId: session.user.id,
    eventName: account.companyName,
    scheduledAt,
    status: 'requested',
    storeAddress: account.address ?? null,
    storeCity: account.city ?? null,
    storeState: account.state ?? null,
    storeZip: account.zip ?? null,
    storePhone: account.phone ?? null,
    notes: `Requested by sales rep${notes ? `: ${notes}` : ''}`,
  })

  const dateLabel = new Date(scheduledAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  const tastingUrl = `${process.env.NEXTAUTH_URL}/admin/tastings/${created.id}`

  // In-app notifications for admins, staff, and sales managers
  await createNotificationsForRoles({
    roles: ['admin', 'staff', 'sales_manager'],
    kind: 'tasting_request',
    title: `Tasting request for ${account.companyName}`,
    body: `${session.user.name} requested a tasting on ${dateLabel}`,
    href: `/admin/tastings/${created.id}`,
  })

  const smsBody = `AHAWC: Tasting request from ${session.user.name} for ${account.companyName} on ${dateLabel}. View: ${tastingUrl}`
  const staffPhones = [
    process.env.ADMIN_NOTIFICATION_PHONE,
    process.env.STAFF_NOTIFICATION_PHONE_2,
    process.env.ORDER_NOTIFY_KRISTEN_PHONE,
  ].filter(Boolean) as string[]

  await Promise.allSettled([
    postGoogleChat(`🍷 Tasting Request\nRep: ${session.user.name}\nAccount: ${account.companyName}\nDate: ${dateLabel}\n${tastingUrl}`),
    ...staffPhones.map(phone => sendSms({ to: phone, body: smsBody, bypassOptOut: true })),
  ])

  revalidatePath('/sales/tastings')
  revalidatePath('/admin/tastings')
  revalidatePath('/staff/tastings')
  return { success: true }
}
