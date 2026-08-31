import { and, eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { communityContacts, eventCommunications, eventParticipants, eventReminders, events } from '@/db/schema'
import { formatEventDateTime, getEventPublicUrl } from '@/lib/events/utils'
import { sendEventEmail } from '@/lib/resend/client'
import { sendSms } from '@/lib/telnyx/client'
import { logActivityEvent } from '@/lib/activity/log'

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  return Boolean(secret && request.headers.get('authorization') === `Bearer ${secret}`)
}

function dueAt(reminder: typeof eventReminders.$inferSelect, event: typeof events.$inferSelect) {
  if (reminder.reminderType === 'thank_you') return new Date(event.endAt.getTime() + Math.abs(reminder.offsetMinutes) * 60000)
  return new Date(event.startAt.getTime() - reminder.offsetMinutes * 60000)
}

function escapeHtml(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const now = new Date()
  const rows = await db.select({ reminder: eventReminders, event: events }).from(eventReminders).innerJoin(events, eq(eventReminders.eventId, events.id)).where(eq(eventReminders.enabled, true))
  const due = rows.filter(({ reminder, event }) => {
    if (reminder.lastSentAt || event.status === 'cancelled' || event.visibility === 'draft') return false
    const delta = now.getTime() - dueAt(reminder, event).getTime()
    return delta >= 0 && delta <= 75 * 60000
  })
  let remindersSent = 0
  let messagesSent = 0
  for (const { reminder, event } of due) {
    const participants = await db.select({ participant: eventParticipants, contact: communityContacts }).from(eventParticipants).innerJoin(communityContacts, eq(eventParticipants.communityContactId, communityContacts.id)).where(and(eq(eventParticipants.eventId, event.id), eq(eventParticipants.rsvpStatus, 'confirmed')))
    const recipients = reminder.reminderType === 'thank_you' ? participants.filter(({ participant }) => participant.attendanceStatus === 'checked_in') : participants
    const title = reminder.reminderType === 'thank_you' ? `Thank you for joining ${event.title}` : `Reminder: ${event.title}`
    const message = reminder.reminderType === 'thank_you' ? `Thank you for joining us at ${event.title}. We loved celebrating with you.` : `${event.title} is coming up ${formatEventDateTime(event.startAt, event.timeZone)}. Details: ${getEventPublicUrl(event.slug)}`
    for (const { participant, contact } of recipients) {
      if (reminder.channels.includes('email') && (contact.status === 'subscribed' || participant.marketingConsent)) {
        const ok = await sendEventEmail({ to: contact.email, recipientName: `${contact.firstName} ${contact.lastName}`, subject: title, title, detailsHtml: `<p>${escapeHtml(message)}</p>`, ctaLabel: 'View event', ctaHref: getEventPublicUrl(event.slug) })
        await db.insert(eventCommunications).values({ eventId: event.id, channel: 'email', audience: `participant:${participant.id}`, messageType: reminder.reminderType, subject: title, body: message, status: ok ? 'sent' : 'failed', recipientCount: 1, sentCount: ok ? 1 : 0, failedCount: ok ? 0 : 1 })
        if (ok) messagesSent += 1
      }
      if (reminder.channels.includes('sms') && (participant.smsConsent || contact.smsConsentAt)) {
        let sent = false
        try { await sendSms({ to: contact.phone, body: message, contactName: `${contact.firstName} ${contact.lastName}` }); sent = true; messagesSent += 1 } catch (error) { console.error('Automated event SMS failed:', error) }
        await db.insert(eventCommunications).values({ eventId: event.id, channel: 'sms', audience: `participant:${participant.id}`, messageType: reminder.reminderType, body: message, status: sent ? 'sent' : 'failed', recipientCount: 1, sentCount: sent ? 1 : 0, failedCount: sent ? 0 : 1 })
      }
    }
    await db.update(eventReminders).set({ lastSentAt: now, updatedAt: now }).where(eq(eventReminders.id, reminder.id))
    await logActivityEvent({ entityType: 'event', entityId: event.id, kind: 'event_automated_reminder_sent', title: title, body: `${messagesSent} messages sent.` })
    remindersSent += 1
  }
  return NextResponse.json({ candidates: due.length, remindersSent, messagesSent })
}
