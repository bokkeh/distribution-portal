'use server'

import { and, eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/db'
import { eventCommunications, eventParticipants, events } from '@/db/schema'
import { isEventRsvpRateLimited } from '@/lib/auth/rate-limit'
import { findOrCreateEventContact } from '@/lib/events/contacts'
import { sendEventConfirmation } from '@/lib/events/communications'
import { parseGuestNames } from '@/lib/events/utils'
import { logActivityEvent } from '@/lib/activity/log'

export type EventRsvpState = {
  success?: boolean
  error?: string
  managementUrl?: string
}

export async function submitEventRsvp(
  _previousState: EventRsvpState | null,
  formData: FormData,
): Promise<EventRsvpState> {
  try {
    if (String(formData.get('website') ?? '').trim()) return { success: true }
    const slug = String(formData.get('slug') ?? '')
    const requestHeaders = await headers()
    const ip = requestHeaders.get('x-forwarded-for')?.split(',')[0]?.trim() ?? requestHeaders.get('x-real-ip') ?? 'unknown'
    if (await isEventRsvpRateLimited(`${slug}:${ip}`)) return { error: 'Too many RSVP attempts. Please try again later.' }

    const [event] = await db.select().from(events).where(eq(events.slug, slug)).limit(1)
    if (!event || !['public', 'link_only'].includes(event.visibility) || event.status !== 'scheduled') return { error: 'RSVPs are not currently open for this event.' }

    const parsed = z.object({
      firstName: z.string().trim().min(1, 'First name is required.').max(80),
      lastName: z.string().trim().min(1, 'Last name is required.').max(80),
      email: z.string().trim().email('Enter a valid email address.').max(254),
      phone: z.string().trim().min(7, 'Enter a valid mobile phone.').max(40),
      guestCount: z.coerce.number().int().min(0).max(20),
      company: z.string().trim().max(160),
      instagramHandle: z.string().trim().max(100),
      notes: z.string().trim().max(2000),
    }).safeParse({
      firstName: formData.get('firstName'), lastName: formData.get('lastName'), email: formData.get('email'), phone: formData.get('phone'),
      guestCount: formData.get('guestCount') || 0, company: formData.get('company') ?? '', instagramHandle: formData.get('instagramHandle') ?? '', notes: formData.get('notes') ?? '',
    })
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check your RSVP details.' }

    const marketingConsent = formData.get('marketingConsent') === 'on'
    const smsConsent = formData.get('smsConsent') === 'on'
    const contact = await findOrCreateEventContact({ ...parsed.data, source: 'event_rsvp', marketingConsent, smsConsent })
    const guestNames = parseGuestNames(String(formData.get('guestNames') ?? ''))
    const [participant] = await db.insert(eventParticipants).values({
      eventId: event.id,
      communityContactId: contact.id,
      rsvpStatus: 'confirmed',
      attendanceStatus: 'not_checked_in',
      source: 'public_rsvp',
      guestCount: parsed.data.guestCount,
      guestNames,
      company: parsed.data.company || null,
      instagramHandle: parsed.data.instagramHandle || null,
      notes: parsed.data.notes || null,
      marketingConsent,
      smsConsent,
    }).onConflictDoUpdate({
      target: [eventParticipants.eventId, eventParticipants.communityContactId],
      set: {
        rsvpStatus: 'confirmed', guestCount: parsed.data.guestCount, guestNames, company: parsed.data.company || null,
        instagramHandle: parsed.data.instagramHandle || null, notes: parsed.data.notes || null,
        marketingConsent, smsConsent, updatedAt: new Date(),
      },
    }).returning()

    const sent = await sendEventConfirmation({ event, participant, contact })
    await db.insert(eventCommunications).values({
      eventId: event.id,
      channel: 'email',
      audience: `participant:${participant.id}`,
      messageType: 'confirmation',
      subject: `You're confirmed for ${event.title}`,
      body: 'Automatic RSVP confirmation.',
      status: sent.emailSent ? 'sent' : 'failed',
      recipientCount: 1,
      sentCount: sent.emailSent ? 1 : 0,
      failedCount: sent.emailSent ? 0 : 1,
    })
    if (smsConsent) {
      await db.insert(eventCommunications).values({
        eventId: event.id, channel: 'sms', audience: `participant:${participant.id}`, messageType: 'confirmation', body: 'Automatic RSVP confirmation.',
        status: sent.smsSent ? 'sent' : 'failed', recipientCount: 1, sentCount: sent.smsSent ? 1 : 0, failedCount: sent.smsSent ? 0 : 1,
      })
    }
    await Promise.all([
      logActivityEvent({ entityType: 'event', entityId: event.id, kind: 'event_rsvp_received', title: 'RSVP received', body: `${contact.firstName} ${contact.lastName}${contact.isNew ? ' joined as a new community contact' : ' matched an existing community contact'}.`, metadata: { participantId: participant.id, contactId: contact.id } }),
      logActivityEvent({ entityType: 'community_contact', entityId: contact.id, kind: 'event_rsvp_confirmed', title: `RSVP'd to ${event.title}`, metadata: { eventId: event.id, participantId: participant.id } }),
    ])
    revalidatePath(`/events/${event.slug}`)
    revalidatePath('/admin/events')
    revalidatePath('/staff/events')
    return { success: true, managementUrl: `/events/${event.slug}/rsvp/${participant.managementToken}` }
  } catch (error) {
    console.error('Event RSVP failed:', error)
    return { error: 'We could not save your RSVP. Please try again.' }
  }
}

export async function updatePublicEventRsvp(
  _previousState: EventRsvpState | null,
  formData: FormData,
): Promise<EventRsvpState> {
  try {
    const slug = String(formData.get('slug') ?? '')
    const token = String(formData.get('token') ?? '')
    const status = z.enum(['confirmed', 'maybe', 'declined']).safeParse(formData.get('rsvpStatus'))
    if (!status.success) return { error: 'Choose a valid RSVP response.' }
    const [row] = await db.select({ participant: eventParticipants, event: events }).from(eventParticipants).innerJoin(events, eq(eventParticipants.eventId, events.id)).where(and(eq(events.slug, slug), eq(eventParticipants.managementToken, token))).limit(1)
    if (!row) return { error: 'This RSVP management link is invalid.' }
    await db.update(eventParticipants).set({ rsvpStatus: status.data, updatedAt: new Date() }).where(eq(eventParticipants.id, row.participant.id))
    await Promise.all([
      logActivityEvent({ entityType: 'event', entityId: row.event.id, kind: 'event_rsvp_updated', title: 'RSVP updated', body: `Status changed to ${status.data}.`, metadata: { participantId: row.participant.id } }),
      logActivityEvent({ entityType: 'community_contact', entityId: row.participant.communityContactId, kind: 'event_rsvp_updated', title: `RSVP updated for ${row.event.title}`, body: status.data, metadata: { eventId: row.event.id } }),
    ])
    revalidatePath(`/events/${slug}`)
    revalidatePath(`/events/${slug}/rsvp/${token}`)
    return { success: true }
  } catch (error) {
    console.error('Public RSVP update failed:', error)
    return { error: 'We could not update your RSVP. Please try again.' }
  }
}
