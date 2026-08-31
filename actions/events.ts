'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { db } from '@/db'
import {
  communityContacts,
  customerAccounts,
  eventCommunications,
  eventMedia,
  eventParticipants,
  eventReminders,
  events,
} from '@/db/schema'
import { requireFeature } from '@/lib/auth/session'
import { logActivityEvent } from '@/lib/activity/log'
import { findOrCreateEventContact } from '@/lib/events/contacts'
import { getEventPublicUrl, localEventDateTimeToUtc, slugifyEventTitle } from '@/lib/events/utils'
import { sendEventEmail } from '@/lib/resend/client'
import { sendSms } from '@/lib/telnyx/client'
import { deleteObject } from '@/lib/gcs/client'

const eventTypeSchema = z.enum(['party', 'pop_up', 'festival', 'community_event', 'retail_activation', 'partner_event', 'dinner', 'sponsorship', 'sports_event', 'trade_event', 'other'])
const visibilitySchema = z.enum(['draft', 'public', 'link_only', 'closed'])

function internalMode(roles: string[]): 'admin' | 'staff' {
  return roles.includes('admin') ? 'admin' : 'staff'
}

function eventPath(mode: 'admin' | 'staff', eventId?: string, key?: 'success' | 'error', message?: string) {
  const base = eventId ? `/${mode}/events/${eventId}` : `/${mode}/events`
  return key && message ? `${base}?${key}=${encodeURIComponent(message)}` : base
}

async function requireEvent(eventId: string) {
  const session = await requireFeature('events', 'admin', 'staff')
  const [event] = await db.select().from(events).where(eq(events.id, eventId)).limit(1)
  if (!event) throw new Error('Event not found.')
  return { event, session, mode: internalMode(session.user.roles ?? [session.user.role]) }
}

async function uniqueSlug(title: string, currentEventId?: string) {
  const base = slugifyEventTitle(title)
  for (let suffix = 0; suffix < 100; suffix += 1) {
    const candidate = suffix === 0 ? base : `${base}-${suffix + 1}`
    const [match] = await db.select({ id: events.id }).from(events).where(eq(events.slug, candidate)).limit(1)
    if (!match || match.id === currentEventId) return candidate
  }
  return `${base}-${Date.now()}`
}

async function accountLocation(accountId: string) {
  const [account] = await db.select({
    id: customerAccounts.id,
    companyName: customerAccounts.companyName,
    address: customerAccounts.address,
    city: customerAccounts.city,
    state: customerAccounts.state,
    zip: customerAccounts.zip,
    contactName: customerAccounts.contactName,
    phone: customerAccounts.phone,
    website: customerAccounts.website,
  }).from(customerAccounts).where(eq(customerAccounts.id, accountId)).limit(1)
  return account
}

export async function createEvent(formData: FormData) {
  const session = await requireFeature('events', 'admin', 'staff')
  const mode = internalMode(session.user.roles ?? [session.user.role])
  const parsed = z.object({
    title: z.string().trim().min(2, 'Event title is required.').max(160),
    description: z.string().trim().max(10000),
    eventType: eventTypeSchema,
    startDate: z.string().min(1),
    startTime: z.string().min(1),
    endDate: z.string().min(1),
    endTime: z.string().min(1),
    timeZone: z.string().trim().min(1).max(100),
    organizerUserId: z.string().uuid().optional().or(z.literal('')),
    locationMode: z.enum(['manual', 'account']),
    accountId: z.string().uuid().optional().or(z.literal('')),
    venueName: z.string().trim().max(200),
    addressLine1: z.string().trim().max(300),
    addressLine2: z.string().trim().max(300),
    city: z.string().trim().max(120),
    state: z.string().trim().max(120),
    postalCode: z.string().trim().max(30),
    country: z.string().trim().max(80),
    sourceChannel: z.string().trim().max(120),
  }).safeParse({
    title: formData.get('title'), description: formData.get('description') ?? '', eventType: formData.get('eventType'),
    startDate: formData.get('startDate'), startTime: formData.get('startTime'), endDate: formData.get('endDate'), endTime: formData.get('endTime'),
    timeZone: formData.get('timeZone') ?? 'America/New_York', organizerUserId: formData.get('organizerUserId') ?? '',
    locationMode: formData.get('locationMode') ?? 'manual', accountId: formData.get('accountId') ?? '',
    venueName: formData.get('venueName') ?? '', addressLine1: formData.get('addressLine1') ?? '', addressLine2: formData.get('addressLine2') ?? '',
    city: formData.get('city') ?? '', state: formData.get('state') ?? '', postalCode: formData.get('postalCode') ?? '', country: formData.get('country') ?? 'US',
    sourceChannel: formData.get('sourceChannel') ?? '',
  })
  if (!parsed.success) redirect(eventPath(mode, undefined, 'error', parsed.error.issues[0]?.message ?? 'Check the event details.'))

  let startAt: Date
  let endAt: Date
  try {
    startAt = localEventDateTimeToUtc(parsed.data.startDate, parsed.data.startTime, parsed.data.timeZone)
    endAt = localEventDateTimeToUtc(parsed.data.endDate, parsed.data.endTime, parsed.data.timeZone)
  } catch (error) {
    redirect(eventPath(mode, undefined, 'error', error instanceof Error ? error.message : 'Enter valid dates.'))
  }
  if (endAt <= startAt) redirect(eventPath(mode, undefined, 'error', 'End time must be after start time.'))

  const optionalFields = formData.getAll('rsvpOptionalFields').map(String)
  let location = {
    accountId: parsed.data.accountId || null,
    venueName: parsed.data.venueName || null,
    addressLine1: parsed.data.addressLine1 || null,
    addressLine2: parsed.data.addressLine2 || null,
    city: parsed.data.city || null,
    state: parsed.data.state || null,
    postalCode: parsed.data.postalCode || null,
    country: parsed.data.country || 'US',
    venueContactName: null as string | null,
    venuePhone: null as string | null,
    venueWebsite: null as string | null,
  }
  if (parsed.data.locationMode === 'account') {
    if (!parsed.data.accountId) redirect(eventPath(mode, undefined, 'error', 'Select an account location.'))
    const account = await accountLocation(parsed.data.accountId)
    if (!account) redirect(eventPath(mode, undefined, 'error', 'The selected account was not found.'))
    location = {
      accountId: account.id, venueName: account.companyName, addressLine1: account.address, addressLine2: null,
      city: account.city, state: account.state, postalCode: account.zip, country: 'US',
      venueContactName: account.contactName, venuePhone: account.phone, venueWebsite: account.website,
    }
  }

  const slug = await uniqueSlug(parsed.data.title)
  const [created] = await db.insert(events).values({
    slug,
    title: parsed.data.title,
    description: parsed.data.description || null,
    eventType: parsed.data.eventType,
    startAt,
    endAt,
    timeZone: parsed.data.timeZone,
    organizerUserId: parsed.data.organizerUserId || session.user.id,
    createdByUserId: session.user.id,
    locationMode: parsed.data.locationMode,
    ...location,
    sourceChannel: parsed.data.sourceChannel || null,
    rsvpOptionalFields: optionalFields,
    attendeeUploadPolicy: 'approval',
  }).returning()

  await db.insert(eventReminders).values([
    { eventId: created.id, reminderType: 'seven_days', offsetMinutes: 10080 },
    { eventId: created.id, reminderType: 'twenty_four_hours', offsetMinutes: 1440 },
    { eventId: created.id, reminderType: 'two_hours', offsetMinutes: 120 },
    { eventId: created.id, reminderType: 'thank_you', offsetMinutes: -1440 },
  ]).onConflictDoNothing()
  await logActivityEvent({ entityType: 'event', entityId: created.id, actorUserId: session.user.id, kind: 'event_created', title: 'Event created', body: `${created.title} was created as a draft.` })
  if (created.accountId) {
    await logActivityEvent({ entityType: 'account', entityId: created.accountId, actorUserId: session.user.id, kind: 'event_attached', title: 'Event attached to account', body: created.title, metadata: { eventId: created.id } })
  }
  revalidatePath(eventPath(mode))
  redirect(eventPath(mode, created.id, 'success', 'Event created. Finish the landing page and publish when ready.'))
}

export async function updateEventDetails(formData: FormData) {
  const eventId = String(formData.get('eventId') ?? '')
  const { event, session, mode } = await requireEvent(eventId)
  const title = String(formData.get('title') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim()
  const eventType = eventTypeSchema.safeParse(formData.get('eventType'))
  const timeZone = String(formData.get('timeZone') ?? event.timeZone).trim()
  if (!title || !eventType.success) redirect(eventPath(mode, eventId, 'error', 'Enter a title and valid event type.'))
  let startAt: Date
  let endAt: Date
  try {
    startAt = localEventDateTimeToUtc(String(formData.get('startDate')), String(formData.get('startTime')), timeZone)
    endAt = localEventDateTimeToUtc(String(formData.get('endDate')), String(formData.get('endTime')), timeZone)
  } catch (error) {
    redirect(eventPath(mode, eventId, 'error', error instanceof Error ? error.message : 'Enter valid dates.'))
  }
  if (endAt <= startAt) redirect(eventPath(mode, eventId, 'error', 'End time must be after start time.'))

  const locationMode = formData.get('locationMode') === 'account' ? 'account' : 'manual'
  const accountId = String(formData.get('accountId') ?? '')
  let location = {
    accountId: accountId || null,
    venueName: String(formData.get('venueName') ?? '').trim() || null,
    addressLine1: String(formData.get('addressLine1') ?? '').trim() || null,
    addressLine2: String(formData.get('addressLine2') ?? '').trim() || null,
    city: String(formData.get('city') ?? '').trim() || null,
    state: String(formData.get('state') ?? '').trim() || null,
    postalCode: String(formData.get('postalCode') ?? '').trim() || null,
    country: String(formData.get('country') ?? 'US').trim() || 'US',
    venueContactName: null as string | null,
    venuePhone: null as string | null,
    venueWebsite: null as string | null,
  }
  if (locationMode === 'account') {
    const account = await accountLocation(accountId)
    if (!account) redirect(eventPath(mode, eventId, 'error', 'Select a valid account location.'))
    location = { accountId: account.id, venueName: account.companyName, addressLine1: account.address, addressLine2: null, city: account.city, state: account.state, postalCode: account.zip, country: 'US', venueContactName: account.contactName, venuePhone: account.phone, venueWebsite: account.website }
  }

  await db.update(events).set({
    title,
    slug: title === event.title ? event.slug : await uniqueSlug(title, event.id),
    description: description || null,
    eventType: eventType.data,
    startAt,
    endAt,
    timeZone,
    organizerUserId: String(formData.get('organizerUserId') ?? '') || null,
    locationMode,
    ...location,
    sourceChannel: String(formData.get('sourceChannel') ?? '').trim() || null,
    rsvpOptionalFields: formData.getAll('rsvpOptionalFields').map(String),
    updatedAt: new Date(),
  }).where(eq(events.id, eventId))
  await logActivityEvent({ entityType: 'event', entityId: eventId, actorUserId: session.user.id, kind: 'event_updated', title: 'Event details updated' })
  if (event.accountId !== location.accountId && location.accountId) {
    await logActivityEvent({ entityType: 'event', entityId: eventId, actorUserId: session.user.id, kind: 'event_account_attached', title: 'Account attached', metadata: { accountId: location.accountId } })
    await logActivityEvent({ entityType: 'account', entityId: location.accountId, actorUserId: session.user.id, kind: 'event_attached', title: 'Event attached to account', body: title, metadata: { eventId } })
  }
  revalidatePath(eventPath(mode, eventId))
  revalidatePath(`/events/${event.slug}`)
  redirect(eventPath(mode, eventId, 'success', 'Event details updated.'))
}

export async function updateEventPublishing(formData: FormData) {
  const eventId = String(formData.get('eventId') ?? '')
  const { event, session, mode } = await requireEvent(eventId)
  const visibility = visibilitySchema.safeParse(formData.get('visibility'))
  const uploadPolicy = z.enum(['disabled', 'immediate', 'approval', 'private']).safeParse(formData.get('attendeeUploadPolicy'))
  if (!visibility.success || !uploadPolicy.success) redirect(eventPath(mode, eventId, 'error', 'Choose valid public page settings.'))
  const status = visibility.data === 'draft' ? 'draft' : event.status === 'draft' ? 'scheduled' : event.status
  await db.update(events).set({ visibility: visibility.data, attendeeUploadPolicy: uploadPolicy.data, status, updatedAt: new Date() }).where(eq(events.id, eventId))
  await logActivityEvent({ entityType: 'event', entityId: eventId, actorUserId: session.user.id, kind: visibility.data === 'draft' ? 'event_unpublished' : 'event_published', title: visibility.data === 'draft' ? 'Landing page returned to draft' : 'Landing page published', body: `Visibility: ${visibility.data.replace('_', ' ')}.` })
  revalidatePath(`/events/${event.slug}`)
  redirect(eventPath(mode, eventId, 'success', 'Public page settings saved.'))
}

async function attachParticipant(input: {
  eventId: string
  contactId: string
  source: 'manual' | 'import'
  actorUserId: string
  rsvpStatus?: 'confirmed' | 'maybe' | 'declined'
  notes?: string | null
}) {
  const [participant] = await db.insert(eventParticipants).values({
    eventId: input.eventId,
    communityContactId: input.contactId,
    source: input.source,
    rsvpStatus: input.rsvpStatus ?? 'confirmed',
    notes: input.notes ?? null,
    createdByUserId: input.actorUserId,
  }).onConflictDoUpdate({
    target: [eventParticipants.eventId, eventParticipants.communityContactId],
    set: { rsvpStatus: input.rsvpStatus ?? 'confirmed', notes: input.notes ?? null, updatedAt: new Date() },
  }).returning()
  return participant
}

export async function addExistingEventAttendee(formData: FormData) {
  const eventId = String(formData.get('eventId') ?? '')
  const contactId = String(formData.get('contactId') ?? '')
  const { event, session, mode } = await requireEvent(eventId)
  const [contact] = await db.select().from(communityContacts).where(eq(communityContacts.id, contactId)).limit(1)
  if (!contact) redirect(eventPath(mode, eventId, 'error', 'Select a valid community contact.'))
  await attachParticipant({ eventId, contactId, source: 'manual', actorUserId: session.user.id, rsvpStatus: 'confirmed', notes: String(formData.get('notes') ?? '').trim() || null })
  await logActivityEvent({ entityType: 'event', entityId: eventId, actorUserId: session.user.id, kind: 'event_attendee_added', title: 'Attendee added manually', body: `${contact.firstName} ${contact.lastName}` })
  await logActivityEvent({ entityType: 'community_contact', entityId: contactId, actorUserId: session.user.id, kind: 'event_rsvp_added', title: `RSVP'd to ${event.title}`, metadata: { eventId } })
  revalidatePath(eventPath(mode, eventId))
  redirect(eventPath(mode, eventId, 'success', 'Attendee added.'))
}

export async function addNewEventAttendee(formData: FormData) {
  const eventId = String(formData.get('eventId') ?? '')
  const { event, session, mode } = await requireEvent(eventId)
  const parsed = z.object({ firstName: z.string().trim().min(1), lastName: z.string().trim().min(1), email: z.string().trim().email(), phone: z.string().trim().min(7) }).safeParse({ firstName: formData.get('firstName'), lastName: formData.get('lastName'), email: formData.get('email'), phone: formData.get('phone') })
  if (!parsed.success) redirect(eventPath(mode, eventId, 'error', 'Enter a valid name, email, and phone number.'))
  const contact = await findOrCreateEventContact({ ...parsed.data, source: 'event_manual', marketingConsent: false, smsConsent: false, createdByUserId: session.user.id })
  await attachParticipant({ eventId, contactId: contact.id, source: 'manual', actorUserId: session.user.id, notes: String(formData.get('notes') ?? '').trim() || null })
  await logActivityEvent({ entityType: 'event', entityId: eventId, actorUserId: session.user.id, kind: 'event_attendee_added', title: 'Attendee added manually', body: `${contact.firstName} ${contact.lastName}${contact.isNew ? ' (new contact)' : ''}.` })
  await logActivityEvent({ entityType: 'community_contact', entityId: contact.id, actorUserId: session.user.id, kind: 'event_rsvp_added', title: `RSVP'd to ${event.title}`, metadata: { eventId } })
  revalidatePath(eventPath(mode, eventId))
  redirect(eventPath(mode, eventId, 'success', contact.isNew ? 'New community contact and attendee created.' : 'Existing contact matched and added.'))
}

export async function importEventAttendees(formData: FormData) {
  const eventId = String(formData.get('eventId') ?? '')
  const { event, session, mode } = await requireEvent(eventId)
  const csv = String(formData.get('csvText') ?? '').trim()
  if (!csv) redirect(eventPath(mode, eventId, 'error', 'Choose a CSV file to import.'))
  const lines = csv.split(/\r?\n/).filter(Boolean).slice(0, 1001)
  const start = /email/i.test(lines[0] ?? '') ? 1 : 0
  let imported = 0
  let failed = 0
  for (const line of lines.slice(start)) {
    const [firstName = '', lastName = '', email = '', phone = '', notes = ''] = line.split(',').map((value) => value.trim().replace(/^"|"$/g, ''))
    try {
      const contact = await findOrCreateEventContact({ firstName, lastName, email, phone, source: 'event_import', marketingConsent: false, smsConsent: false, createdByUserId: session.user.id })
      await attachParticipant({ eventId, contactId: contact.id, source: 'import', actorUserId: session.user.id, notes: notes || null })
      await logActivityEvent({ entityType: 'community_contact', entityId: contact.id, actorUserId: session.user.id, kind: 'event_rsvp_imported', title: `Added to ${event.title}`, metadata: { eventId } })
      imported += 1
    } catch {
      failed += 1
    }
  }
  await logActivityEvent({ entityType: 'event', entityId: eventId, actorUserId: session.user.id, kind: 'event_attendees_imported', title: 'Attendee import completed', body: `${imported} imported; ${failed} skipped.` })
  revalidatePath(eventPath(mode, eventId))
  redirect(eventPath(mode, eventId, imported ? 'success' : 'error', `${imported} attendees imported${failed ? `; ${failed} rows skipped` : ''}.`))
}

export async function updateEventParticipant(formData: FormData) {
  const eventId = String(formData.get('eventId') ?? '')
  const participantId = String(formData.get('participantId') ?? '')
  const { event, session, mode } = await requireEvent(eventId)
  const rsvpStatus = z.enum(['confirmed', 'maybe', 'declined']).safeParse(formData.get('rsvpStatus'))
  const attendanceStatus = z.enum(['not_checked_in', 'checked_in', 'no_show']).safeParse(formData.get('attendanceStatus'))
  if (!rsvpStatus.success || !attendanceStatus.success) redirect(eventPath(mode, eventId, 'error', 'Choose valid RSVP and attendance statuses.'))
  const [participant] = await db.update(eventParticipants).set({
    rsvpStatus: rsvpStatus.data,
    attendanceStatus: attendanceStatus.data,
    notes: String(formData.get('notes') ?? '').trim() || null,
    checkedInAt: attendanceStatus.data === 'checked_in' ? new Date() : null,
    updatedAt: new Date(),
  }).where(and(eq(eventParticipants.id, participantId), eq(eventParticipants.eventId, eventId))).returning()
  if (!participant) redirect(eventPath(mode, eventId, 'error', 'Attendee not found.'))
  const activityTitle = attendanceStatus.data === 'checked_in' ? `Attended ${event.title}` : attendanceStatus.data === 'no_show' ? `No-show for ${event.title}` : `RSVP updated for ${event.title}`
  await Promise.all([
    logActivityEvent({ entityType: 'event', entityId: eventId, actorUserId: session.user.id, kind: attendanceStatus.data === 'checked_in' ? 'event_attendee_checked_in' : 'event_attendee_updated', title: activityTitle, metadata: { participantId } }),
    logActivityEvent({ entityType: 'community_contact', entityId: participant.communityContactId, actorUserId: session.user.id, kind: attendanceStatus.data === 'checked_in' ? 'event_attended' : 'event_rsvp_updated', title: activityTitle, metadata: { eventId } }),
  ])
  revalidatePath(eventPath(mode, eventId))
  redirect(eventPath(mode, eventId, 'success', 'Attendee updated.'))
}

export async function removeEventParticipant(formData: FormData) {
  const eventId = String(formData.get('eventId') ?? '')
  const participantId = String(formData.get('participantId') ?? '')
  const { session, mode } = await requireEvent(eventId)
  const [removed] = await db.delete(eventParticipants).where(and(eq(eventParticipants.id, participantId), eq(eventParticipants.eventId, eventId))).returning()
  if (removed) await logActivityEvent({ entityType: 'event', entityId: eventId, actorUserId: session.user.id, kind: 'event_attendee_removed', title: 'Attendee removed', metadata: { contactId: removed.communityContactId } })
  revalidatePath(eventPath(mode, eventId))
  redirect(eventPath(mode, eventId, 'success', 'Attendee removed.'))
}

export async function saveEventMedia(formData: FormData) {
  const eventId = String(formData.get('eventId') ?? '')
  const { event, session, mode } = await requireEvent(eventId)
  const storagePath = String(formData.get('storagePath') ?? '').trim()
  const fileName = String(formData.get('fileName') ?? '').trim()
  const contentType = String(formData.get('contentType') ?? '').trim()
  const mediaType = z.enum(['image', 'video', 'pdf', 'document']).safeParse(formData.get('mediaType'))
  const placement = z.enum(['hero', 'gallery', 'promotional', 'attachment', 'internal']).safeParse(formData.get('placement'))
  if (!storagePath.startsWith('events/') || !fileName || !contentType || !mediaType.success || !placement.success) redirect(eventPath(mode, eventId, 'error', 'Upload a valid event file.'))
  if (placement.data === 'hero' && mediaType.data !== 'image') redirect(eventPath(mode, eventId, 'error', 'The event hero must be an image.'))
  if (placement.data === 'hero') await db.update(eventMedia).set({ placement: 'gallery' }).where(and(eq(eventMedia.eventId, eventId), eq(eventMedia.placement, 'hero')))
  const [media] = await db.insert(eventMedia).values({ eventId, storagePath, fileName, contentType, mediaType: mediaType.data, placement: placement.data, approvalStatus: placement.data === 'internal' ? 'private' : 'approved', uploadedByUserId: session.user.id, caption: String(formData.get('caption') ?? '').trim() || null }).returning()
  await logActivityEvent({ entityType: 'event', entityId: eventId, actorUserId: session.user.id, kind: placement.data === 'hero' ? 'event_hero_changed' : 'event_media_uploaded', title: placement.data === 'hero' ? 'Hero image changed' : 'Event media uploaded', body: fileName, metadata: { mediaId: media.id } })
  revalidatePath(eventPath(mode, eventId))
  revalidatePath(`/events/${event.slug}`)
  redirect(eventPath(mode, eventId, 'success', 'Media saved.'))
}

export async function moderateEventMedia(formData: FormData) {
  const eventId = String(formData.get('eventId') ?? '')
  const mediaId = String(formData.get('mediaId') ?? '')
  const status = z.enum(['approved', 'rejected', 'private']).safeParse(formData.get('approvalStatus'))
  const { event, session, mode } = await requireEvent(eventId)
  if (!status.success) redirect(eventPath(mode, eventId, 'error', 'Choose a valid moderation status.'))
  await db.update(eventMedia).set({ approvalStatus: status.data, featured: formData.get('featured') === 'true', reviewedByUserId: session.user.id, reviewedAt: new Date() }).where(and(eq(eventMedia.id, mediaId), eq(eventMedia.eventId, eventId)))
  await logActivityEvent({ entityType: 'event', entityId: eventId, actorUserId: session.user.id, kind: 'event_media_moderated', title: 'Event media moderated', body: status.data, metadata: { mediaId } })
  revalidatePath(eventPath(mode, eventId)); revalidatePath(`/events/${event.slug}`)
  redirect(eventPath(mode, eventId, 'success', 'Media moderation updated.'))
}

export async function removeEventMedia(formData: FormData) {
  const eventId = String(formData.get('eventId') ?? '')
  const mediaId = String(formData.get('mediaId') ?? '')
  const { event, session, mode } = await requireEvent(eventId)
  const [removed] = await db.delete(eventMedia).where(and(eq(eventMedia.id, mediaId), eq(eventMedia.eventId, eventId))).returning()
  if (removed) {
    try { await deleteObject(removed.storagePath) } catch (error) { console.error('Failed to delete event object:', error) }
    await logActivityEvent({ entityType: 'event', entityId: eventId, actorUserId: session.user.id, kind: 'event_media_deleted', title: 'Event media deleted', body: removed.fileName })
  }
  revalidatePath(eventPath(mode, eventId)); revalidatePath(`/events/${event.slug}`)
  redirect(eventPath(mode, eventId, 'success', 'Media deleted.'))
}

export async function sendEventCommunication(formData: FormData) {
  const eventId = String(formData.get('eventId') ?? '')
  const { event, session, mode } = await requireEvent(eventId)
  const channel = z.enum(['email', 'sms']).safeParse(formData.get('channel'))
  const audience = String(formData.get('audience') ?? 'everyone')
  const messageType = String(formData.get('messageType') ?? 'custom')
  const subject = String(formData.get('subject') ?? '').trim()
  const body = String(formData.get('body') ?? '').trim()
  if (!channel.success || !body || (channel.data === 'email' && !subject)) redirect(eventPath(mode, eventId, 'error', 'Choose a channel and enter the required message fields.'))
  const rows = await db.select({ participant: eventParticipants, contact: communityContacts }).from(eventParticipants).innerJoin(communityContacts, eq(eventParticipants.communityContactId, communityContacts.id)).where(eq(eventParticipants.eventId, eventId))
  const selectedIds = new Set(formData.getAll('selectedParticipantId').map(String))
  const recipients = rows.filter(({ participant }) => {
    if (audience === 'confirmed') return participant.rsvpStatus === 'confirmed'
    if (audience === 'checked_in') return participant.attendanceStatus === 'checked_in'
    if (audience === 'no_show') return participant.attendanceStatus === 'no_show'
    if (audience === 'not_checked_in') return participant.attendanceStatus === 'not_checked_in'
    if (audience === 'selected') return selectedIds.has(participant.id)
    return participant.rsvpStatus !== 'declined'
  }).filter(({ participant, contact }) => channel.data === 'email' ? contact.status === 'subscribed' || participant.marketingConsent : Boolean(contact.smsConsentAt || participant.smsConsent))
  let sent = 0
  let failed = 0
  for (const { contact } of recipients) {
    try {
      if (channel.data === 'email') {
        const ok = await sendEventEmail({ to: contact.email, recipientName: `${contact.firstName} ${contact.lastName}`, subject, title: subject, detailsHtml: `<p>${body.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('\n', '<br/>')}</p>`, ctaLabel: 'View event', ctaHref: getEventPublicUrl(event.slug), userId: session.user.id })
        if (ok) sent += 1
        else failed += 1
      } else {
        await sendSms({ to: contact.phone, body, userId: session.user.id, contactName: `${contact.firstName} ${contact.lastName}` })
        sent += 1
      }
    } catch { failed += 1 }
  }
  await db.insert(eventCommunications).values({ eventId, channel: channel.data, audience, messageType, subject: subject || null, body, status: failed === 0 ? 'sent' : sent ? 'partial' : 'failed', recipientCount: recipients.length, sentCount: sent, failedCount: failed, actorUserId: session.user.id })
  await logActivityEvent({ entityType: 'event', entityId: eventId, actorUserId: session.user.id, kind: 'event_message_sent', title: `${messageType.replaceAll('_', ' ')} sent`, body: `${channel.data.toUpperCase()} to ${sent} recipient${sent === 1 ? '' : 's'}${failed ? `; ${failed} failed` : ''}.` })
  revalidatePath(eventPath(mode, eventId))
  redirect(eventPath(mode, eventId, sent ? 'success' : 'error', sent ? `Message sent to ${sent} recipient${sent === 1 ? '' : 's'}.` : 'No eligible recipients were messaged.'))
}

export async function saveEventReminders(formData: FormData) {
  const eventId = String(formData.get('eventId') ?? '')
  const { session, mode } = await requireEvent(eventId)
  const types = ['seven_days', 'twenty_four_hours', 'two_hours', 'thank_you'] as const
  for (const reminderType of types) {
    const enabled = formData.get(`enabled_${reminderType}`) === 'on'
    const channels = ['email', 'sms'].filter((channel) => formData.get(`${channel}_${reminderType}`) === 'on') as Array<'email' | 'sms'>
    await db.update(eventReminders).set({ enabled, channels: channels.length ? channels : ['email'], updatedAt: new Date() }).where(and(eq(eventReminders.eventId, eventId), eq(eventReminders.reminderType, reminderType)))
  }
  await logActivityEvent({ entityType: 'event', entityId: eventId, actorUserId: session.user.id, kind: 'event_reminders_updated', title: 'Automated reminders updated' })
  revalidatePath(eventPath(mode, eventId))
  redirect(eventPath(mode, eventId, 'success', 'Reminder schedule saved.'))
}

export async function completeEvent(formData: FormData) {
  const eventId = String(formData.get('eventId') ?? '')
  const { event, session, mode } = await requireEvent(eventId)
  await db.update(events).set({ status: 'completed', visibility: event.visibility === 'draft' ? 'closed' : event.visibility, updatedAt: new Date() }).where(eq(events.id, eventId))
  await logActivityEvent({ entityType: 'event', entityId: eventId, actorUserId: session.user.id, kind: 'event_completed', title: 'Event completed' })
  revalidatePath(eventPath(mode, eventId)); revalidatePath(eventPath(mode)); revalidatePath(`/events/${event.slug}`)
  redirect(eventPath(mode, eventId, 'success', 'Event marked complete. Review the summary and follow-up actions below.'))
}

export async function cancelEvent(formData: FormData) {
  const eventId = String(formData.get('eventId') ?? '')
  const { event, session, mode } = await requireEvent(eventId)
  await db.update(events).set({ status: 'cancelled', visibility: 'closed', updatedAt: new Date() }).where(eq(events.id, eventId))
  await logActivityEvent({ entityType: 'event', entityId: eventId, actorUserId: session.user.id, kind: 'event_cancelled', title: 'Event cancelled' })
  revalidatePath(eventPath(mode, eventId)); revalidatePath(eventPath(mode)); revalidatePath(`/events/${event.slug}`)
  redirect(eventPath(mode, eventId, 'success', 'Event cancelled and RSVPs closed.'))
}

export async function deleteEvent(eventId: string) {
  const session = await requireFeature('events', 'admin')
  const roles = session.user.roles ?? [session.user.role]
  if (!roles.includes('admin')) throw new Error('Only administrators can delete events.')
  const [event] = await db.select().from(events).where(eq(events.id, eventId)).limit(1)
  if (!event) redirect('/admin/events')
  const media = await db.select({ storagePath: eventMedia.storagePath }).from(eventMedia).where(eq(eventMedia.eventId, eventId))
  for (const item of media) {
    try { await deleteObject(item.storagePath) } catch (error) { console.error('Failed to delete event object:', error) }
  }
  await db.delete(events).where(eq(events.id, eventId))
  revalidatePath('/admin/events')
  redirect('/admin/events?success=Event%20deleted.')
}
