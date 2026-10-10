'use server'

import { createHash } from 'node:crypto'
import { and, eq, sql } from 'drizzle-orm'
import { after } from 'next/server'
import { db } from '@/db'
import { customerAccounts, salesMembers, tastings, users } from '@/db/schema'
import { requireFeature } from '@/lib/auth/session'
import { getAccountTastingLocations } from '@/lib/tastings/locations'
import { normalizeVenueIdentity, quickScheduleSchema, type QuickScheduleInput } from '@/lib/tastings/scheduling'
import { formatEasternDate, formatEasternTimeRange, parseDateTimeInTimeZone } from '@/lib/tastings/time'
import { refreshTastingViews } from '@/lib/tastings/revalidate'
import { notify } from '@/lib/notifications/dispatch'
import { logActivityEvent } from '@/lib/activity/log'
import { formatTastingSmsPayload, queueScheduledTastingSmsJobs } from '@/lib/tastings/sms-series'
import { getUserPreferences } from '@/lib/preferences/read'

export async function quickScheduleTasting(raw: QuickScheduleInput) {
  const session = await requireFeature('tastings', 'admin', 'staff', 'sales_manager', 'sales_rep')
  const parsed = quickScheduleSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const input = parsed.data
  const fingerprint = createHash('sha256').update(JSON.stringify(input)).digest('hex')
  try {
    // Check before venue creation and conflicts so retries after a lost response find the original booking.
    const [existing] = await db.select().from(tastings).where(eq(tastings.id, input.requestId)).limit(1)
    if (existing) {
      if (existing.createdByUserId !== session.user.id || existing.schedulingFingerprint !== fingerprint) return { error: 'This request was already saved with different details. Start the next tasting to make another booking.' }
      const [assignee] = existing.assignedUserId ? await db.select({ name: users.name }).from(users).where(eq(users.id, existing.assignedUserId)) : []
      refreshTastingViews(existing.customerId, existing.id)
      return { success: true as const, tastingId: existing.id, accountId: existing.customerId, confirmation: `${existing.eventName} · ${formatEasternDate(existing.scheduledAt, existing.timeZone)} · ${formatEasternTimeRange(existing.scheduledAt, existing.endAt, existing.timeZone)} · ${assignee?.name ?? 'Unassigned'}` }
    }

    const roles = session.user.roles
    const repOnly = !roles.some(role => ['admin', 'staff', 'sales_manager'].includes(role))
    const [member] = repOnly ? await db.select().from(salesMembers).where(eq(salesMembers.userId, session.user.id)).limit(1) : []
    if (repOnly && (!member || member.status !== 'active')) return { error: 'An active sales assignment is required. Ask an administrator to check your access.' }

    let accountId = input.accountId
    if (!accountId) {
      // A conservative name match asks the operator to select, never silently merges accounts.
      const schedulingVenueKey = [input.venueName, input.venueAddress, input.venueCity, input.venueState, input.venueZip].map(normalizeVenueIdentity).join('|')
      const [previousVenue] = await db.select({ id: customerAccounts.id }).from(customerAccounts).where(eq(customerAccounts.schedulingVenueKey, schedulingVenueKey)).limit(1)
      if (previousVenue) accountId = previousVenue.id
      else {
      const candidates = await db.select({ id: customerAccounts.id, companyName: customerAccounts.companyName }).from(customerAccounts)
      const matches = candidates.filter(account => normalizeVenueIdentity(account.companyName) === normalizeVenueIdentity(input.venueName))
      if (matches.length) return { error: `A venue with this name already exists. Select its account/location, or use a distinct venue name.`, matches }
      const [venue] = await db.insert(customerAccounts).values({
        companyName: input.venueName, address: input.venueAddress || null, city: input.venueCity || null,
        state: input.venueState || null, zip: input.venueZip || null, schedulingVenueKey,
        assignedSalesRepId: member?.id ?? null, customerSource: 'manual', dealStage: null,
      }).onConflictDoUpdate({ target: customerAccounts.schedulingVenueKey, set: { schedulingVenueKey } }).returning({ id: customerAccounts.id })
      accountId = venue.id
      }
    }
    const [account] = await db.select().from(customerAccounts).where(eq(customerAccounts.id, accountId)).limit(1)
    if (!account) return { error: 'Account no longer exists. Choose another account.' }
    if (repOnly && account.assignedSalesRepId !== member?.id) return { error: 'You are not assigned to this account.' }
    const location = getAccountTastingLocations(account)[input.locationIndex]
    if (!location) return { error: 'Choose a valid account location.' }
    const [assignee] = input.assignedUserId ? await db.select().from(users).where(eq(users.id, input.assignedUserId)).limit(1) : []
    if (input.assignedUserId && (!assignee?.active || !assignee.roles.some(role => ['admin', 'staff', 'sales_manager', 'sales_rep', 'taster'].includes(role)))) return { error: 'Choose an active team member or Unassigned.' }
    const scheduledAt = parseDateTimeInTimeZone(input.date, input.startTime, input.timeZone)
    const endAt = parseDateTimeInTimeZone(input.date, input.endTime, input.timeZone)
    // Check assignee overlap, but do not gate scheduling on CRM/inventory/economics enrichment.
    if (assignee) {
      const [conflict] = await db.select({ id: tastings.id }).from(tastings).where(and(
        eq(tastings.assignedUserId, assignee.id),
        sql`${tastings.id} <> ${input.requestId}::uuid`,
        sql`${tastings.status} IN ('scheduled', 'confirmed')`,
        sql`${tastings.scheduledAt} < ${endAt.toISOString()}::timestamptz`,
        sql`COALESCE(${tastings.endAt}, ${tastings.scheduledAt} + interval '2 hours') > ${scheduledAt.toISOString()}::timestamptz`,
      )).limit(1)
      if (conflict) return { error: 'This team member has an overlapping tasting. Choose another member or Unassigned.' }
    }
    const notes = [input.contact ? `Venue contact: ${input.contact}` : '', input.notes].filter(Boolean).join('\n') || null
    const [saved] = await db.insert(tastings).values({
      id: input.requestId, schedulingFingerprint: fingerprint, customerId: account.id,
      assignedUserId: assignee?.id ?? null, createdByUserId: session.user.id,
      eventName: account.companyName, scheduledAt, endAt, timeZone: input.timeZone, status: 'scheduled',
      storeAddress: location.address, storeCity: location.city, storeState: location.state, storeZip: location.zip,
      storePhone: account.phone, notes,
    }).onConflictDoNothing({ target: tastings.id }).returning({ id: tastings.id })
    if (!saved) {
      const [retry] = await db.select().from(tastings).where(eq(tastings.id, input.requestId)).limit(1)
      if (!retry || retry.createdByUserId !== session.user.id || retry.schedulingFingerprint !== fingerprint) return { error: 'Request conflict. Start the next tasting and try again.' }
    }
    refreshTastingViews(account.id, input.requestId)
    if (saved) {
      // External services cannot turn a confirmed database save into a reported failure.
      after(async () => {
        try {
          await logActivityEvent({ entityType: 'tasting', entityId: saved.id, actorUserId: session.user.id, relatedUserId: assignee?.id ?? null, kind: 'tasting_created', title: 'Tasting scheduled', body: `${account.companyName} · ${assignee?.name ?? 'Unassigned'}` })
          if (!assignee) return
          const prefs = await getUserPreferences(assignee.id)
          const storeAddress = [location.address, location.city, location.state, location.zip].filter(Boolean).join(', ')
          if (assignee.phone && (prefs.smsNotificationsEnabled ?? true)) await queueScheduledTastingSmsJobs({
            ...formatTastingSmsPayload({ tastingId: saved.id, userId: assignee.id, phoneNumber: assignee.phone, storeName: account.companyName, storeAddress, timeZone: input.timeZone, scheduledAt, endAt }), scheduledAt, endAt,
          })
          await notify('tasting.taster_assigned', { tasterName: assignee.name, tasterEmail: prefs.emailNotificationsEnabled ? assignee.email : '', tasterPhone: prefs.smsNotificationsEnabled ? assignee.phone : null, storeName: account.companyName, storeAddress, timeZone: input.timeZone, scheduledAt, endAt, notes, tastingId: saved.id, userId: prefs.inAppNotificationsEnabled ? assignee.id : null })
        } catch (error) { console.error('Tasting saved; follow-up notification failed:', error) }
      })
    }
    return { success: true as const, tastingId: input.requestId, accountId: account.id, confirmation: `${account.companyName} · ${formatEasternDate(scheduledAt, input.timeZone)} · ${formatEasternTimeRange(scheduledAt, endAt, input.timeZone)} · ${assignee?.name ?? 'Unassigned'}` }
  } catch (error) {
    console.error('Quick tasting scheduling failed:', error)
    return { error: 'Could not confirm the save. Your details are kept. Check your connection and retry; the same request will not create a second tasting.' }
  }
}
