'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { db } from '@/db'
import {
  communityContactCommunications,
  communityContactNotes,
  communityContacts,
  communityEventAttendance,
  tastings,
} from '@/db/schema'
import { sendQuickEmail } from '@/actions/notifications'
import { requireFeature } from '@/lib/auth/session'
import { logActivityEvent } from '@/lib/activity/log'
import { sendSms } from '@/lib/telnyx/client'

const profileSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required.').max(80),
  lastName: z.string().trim().min(1, 'Last name is required.').max(80),
  email: z.string().trim().email('Enter a valid email address.').max(254).transform((value) => value.toLowerCase()),
  phone: z.string().trim().min(7, 'Enter a valid phone number.').max(40),
  status: z.enum(['subscribed', 'unsubscribed']),
  addressLine1: z.string().trim().max(200),
  addressLine2: z.string().trim().max(200),
  city: z.string().trim().max(100),
  state: z.string().trim().max(100),
  postalCode: z.string().trim().max(24),
  country: z.string().trim().max(80),
})

function contactPath(contactId: string, key?: 'success' | 'error', message?: string) {
  const base = `/admin/crm/community/${contactId}`
  return key && message ? `${base}?${key}=${encodeURIComponent(message)}` : base
}

async function requireCommunityContact(contactId: string) {
  const [contact] = await db
    .select({ id: communityContacts.id, firstName: communityContacts.firstName, lastName: communityContacts.lastName, email: communityContacts.email, phone: communityContacts.phone })
    .from(communityContacts)
    .where(eq(communityContacts.id, contactId))
    .limit(1)
  if (!contact) throw new Error('Community contact not found.')
  return contact
}

export async function updateCommunityContactProfile(formData: FormData) {
  const session = await requireFeature('crm', 'admin')
  const contactId = String(formData.get('contactId') ?? '')
  await requireCommunityContact(contactId)

  const parsed = profileSchema.safeParse({
    firstName: formData.get('firstName'),
    lastName: formData.get('lastName'),
    email: formData.get('email'),
    phone: formData.get('phone'),
    status: formData.get('status'),
    addressLine1: formData.get('addressLine1') ?? '',
    addressLine2: formData.get('addressLine2') ?? '',
    city: formData.get('city') ?? '',
    state: formData.get('state') ?? '',
    postalCode: formData.get('postalCode') ?? '',
    country: formData.get('country') ?? 'US',
  })
  if (!parsed.success) redirect(contactPath(contactId, 'error', parsed.error.issues[0]?.message ?? 'Check the profile details.'))

  try {
    await db.update(communityContacts).set({
      ...parsed.data,
      addressLine1: parsed.data.addressLine1 || null,
      addressLine2: parsed.data.addressLine2 || null,
      city: parsed.data.city || null,
      state: parsed.data.state || null,
      postalCode: parsed.data.postalCode || null,
      country: parsed.data.country || 'US',
      updatedAt: new Date(),
    }).where(eq(communityContacts.id, contactId))
  } catch (error) {
    const message = error instanceof Error && error.message.toLowerCase().includes('unique')
      ? 'That email address belongs to another community contact.'
      : 'Unable to update this profile.'
    redirect(contactPath(contactId, 'error', message))
  }

  await logActivityEvent({
    entityType: 'community_contact',
    entityId: contactId,
    actorUserId: session.user.id,
    kind: 'community_contact_updated',
    title: 'Profile updated',
    body: 'Contact details, consent status, or address information changed.',
  })
  revalidatePath('/admin/crm')
  revalidatePath(contactPath(contactId))
  redirect(contactPath(contactId, 'success', 'Profile updated.'))
}

export async function addCommunityContactNote(formData: FormData) {
  const session = await requireFeature('crm', 'admin')
  const contactId = String(formData.get('contactId') ?? '')
  const body = String(formData.get('body') ?? '').trim()
  await requireCommunityContact(contactId)
  if (!body) redirect(contactPath(contactId, 'error', 'Enter a note first.'))
  if (body.length > 5000) redirect(contactPath(contactId, 'error', 'Notes must be 5,000 characters or fewer.'))

  await db.insert(communityContactNotes).values({ communityContactId: contactId, body, authorUserId: session.user.id })
  await logActivityEvent({
    entityType: 'community_contact',
    entityId: contactId,
    actorUserId: session.user.id,
    kind: 'community_contact_note_added',
    title: 'Note added',
    body,
  })
  revalidatePath(contactPath(contactId))
  redirect(contactPath(contactId, 'success', 'Note added.'))
}

export async function addCommunityEventAttendance(formData: FormData) {
  const session = await requireFeature('crm', 'admin')
  const contactId = String(formData.get('contactId') ?? '')
  const tastingId = String(formData.get('tastingId') ?? '')
  const notes = String(formData.get('notes') ?? '').trim()
  await requireCommunityContact(contactId)

  const [tasting] = await db.select({ id: tastings.id, eventName: tastings.eventName, scheduledAt: tastings.scheduledAt })
    .from(tastings).where(eq(tastings.id, tastingId)).limit(1)
  if (!tasting) redirect(contactPath(contactId, 'error', 'Choose a valid event.'))

  const rawAttendedAt = String(formData.get('attendedAt') ?? '').trim()
  const attendedAt = rawAttendedAt ? new Date(rawAttendedAt) : new Date(tasting.scheduledAt)
  if (Number.isNaN(attendedAt.getTime())) redirect(contactPath(contactId, 'error', 'Enter a valid attendance date.'))

  await db.insert(communityEventAttendance).values({
    communityContactId: contactId,
    tastingId,
    attendedAt,
    notes: notes || null,
    createdByUserId: session.user.id,
  }).onConflictDoUpdate({
    target: [communityEventAttendance.communityContactId, communityEventAttendance.tastingId],
    set: { attendedAt, notes: notes || null, createdByUserId: session.user.id },
  })
  await logActivityEvent({
    entityType: 'community_contact',
    entityId: contactId,
    actorUserId: session.user.id,
    kind: 'community_event_attendance_added',
    title: 'Event attendance recorded',
    body: `${tasting.eventName} on ${attendedAt.toLocaleDateString('en-US')}.`,
    metadata: { tastingId },
  })
  revalidatePath(contactPath(contactId))
  redirect(contactPath(contactId, 'success', 'Event attendance saved.'))
}

export async function removeCommunityEventAttendance(formData: FormData) {
  const session = await requireFeature('crm', 'admin')
  const contactId = String(formData.get('contactId') ?? '')
  const attendanceId = String(formData.get('attendanceId') ?? '')
  await requireCommunityContact(contactId)
  await db.delete(communityEventAttendance).where(and(eq(communityEventAttendance.id, attendanceId), eq(communityEventAttendance.communityContactId, contactId)))
  await logActivityEvent({ entityType: 'community_contact', entityId: contactId, actorUserId: session.user.id, kind: 'community_event_attendance_removed', title: 'Event attendance removed' })
  revalidatePath(contactPath(contactId))
  redirect(contactPath(contactId, 'success', 'Attendance removed.'))
}

export async function sendCommunityContactCommunication(formData: FormData) {
  const session = await requireFeature('crm', 'admin')
  const contactId = String(formData.get('contactId') ?? '')
  const channel = formData.get('channel') === 'sms' ? 'sms' : 'email'
  const subject = String(formData.get('subject') ?? '').trim()
  const body = String(formData.get('body') ?? '').trim()
  const contact = await requireCommunityContact(contactId)
  const recipientName = `${contact.firstName} ${contact.lastName}`.trim()
  if (!body) redirect(contactPath(contactId, 'error', 'Enter a message first.'))

  if (channel === 'email') {
    if (!subject) redirect(contactPath(contactId, 'error', 'Enter an email subject.'))
    const result = await sendQuickEmail(contact.email, recipientName, subject, body)
    await db.insert(communityContactCommunications).values({
      communityContactId: contactId,
      channel: 'email',
      subject,
      body,
      status: result.error ? 'failed' : 'sent',
      actorUserId: session.user.id,
    })
    if (result.error) redirect(contactPath(contactId, 'error', result.error))
  } else {
    try {
      await sendSms({ to: contact.phone, body, userId: session.user.id, contactName: recipientName })
    } catch (error) {
      redirect(contactPath(contactId, 'error', error instanceof Error ? error.message : 'SMS failed.'))
    }
  }

  await logActivityEvent({
    entityType: 'community_contact',
    entityId: contactId,
    actorUserId: session.user.id,
    kind: `community_contact_${channel}_sent`,
    title: channel === 'email' ? 'Email sent' : 'SMS sent',
    body: channel === 'email' ? `${subject}: ${body}` : body,
  })
  revalidatePath(contactPath(contactId))
  redirect(contactPath(contactId, 'success', `${channel === 'email' ? 'Email' : 'SMS'} sent.`))
}
