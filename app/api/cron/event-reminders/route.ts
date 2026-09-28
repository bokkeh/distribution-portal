import { and, eq, inArray } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { communityContacts, eventCommunications, eventParticipants, eventReminders, events, users } from '@/db/schema'
import { formatEventDateTime, getEventBaseUrl, getEventPublicUrl } from '@/lib/events/utils'
import { sendEventEmail } from '@/lib/resend/client'
import { sendSms } from '@/lib/telnyx/client'
import { logActivityEvent } from '@/lib/activity/log'

const internalEventRoles = new Set(['admin', 'staff', 'sales_rep', 'sales_manager', 'taster', 'driver'])

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  return Boolean(secret && request.headers.get('authorization') === `Bearer ${secret}`)
}

function dueAt(reminder: typeof eventReminders.$inferSelect, event: typeof events.$inferSelect) {
  if (!event.startAt || !event.endAt) return null
  if (reminder.reminderType === 'thank_you') return new Date(event.endAt.getTime() + Math.abs(reminder.offsetMinutes) * 60000)
  return new Date(event.startAt.getTime() - reminder.offsetMinutes * 60000)
}

function escapeHtml(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

function reminderTitle(eventTitle: string, reminderType: string, internal: boolean) {
  if (reminderType === 'thank_you') return internal ? `Post-event follow-up: ${eventTitle}` : `Thank you for joining ${eventTitle}`
  if (reminderType === 'morning_of') return `${internal ? 'Team reminder' : 'Today'}: ${eventTitle}`
  return `${internal ? 'Team reminder' : 'Reminder'}: ${eventTitle}`
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const now = new Date()
  const rows = await db.select({ reminder: eventReminders, event: events }).from(eventReminders).innerJoin(events, eq(eventReminders.eventId, events.id)).where(eq(eventReminders.enabled, true))
  const due = rows.filter(({ reminder, event }) => {
    if (reminder.lastSentAt || event.archivedAt || event.status === 'cancelled' || event.status === 'draft') return false
    if (reminder.audience === 'participants' && event.visibility === 'draft') return false
    const scheduledFor = dueAt(reminder, event)
    if (!scheduledFor) return false
    const delta = now.getTime() - scheduledFor.getTime()
    return delta >= 0 && delta <= 75 * 60000
  })

  let remindersSent = 0
  let messagesSent = 0
  for (const { reminder, event } of due) {
    const internal = reminder.audience === 'internal'
    const title = reminderTitle(event.title, reminder.reminderType, internal)
    const eventDate = event.startAt ? formatEventDateTime(event.startAt, event.timeZone) : 'Date not set'
    const publicUrl = getEventPublicUrl(event.slug)
    const internalUrl = `${getEventBaseUrl()}/admin/events/${event.id}`
    const message = reminder.reminderType === 'thank_you'
      ? internal
        ? `${event.title} has ended. Review attendance, product usage, media, and follow-up actions: ${internalUrl}`
        : `Thank you for joining us at ${event.title}. We loved celebrating with you.`
      : internal
        ? `${event.title} is scheduled for ${eventDate}. Review the internal event plan: ${internalUrl}`
        : `${event.title} is coming up ${eventDate}. Details: ${publicUrl}`
    const sentBefore = messagesSent

    if (internal) {
      const recipientIds = new Set(reminder.recipientUserIds)
      if (reminder.includeOwner && event.organizerUserId) recipientIds.add(event.organizerUserId)
      if (reminder.includeAssignedTeam) event.assignedTeamMemberIds.forEach((id) => recipientIds.add(id))
      const recipients = recipientIds.size
        ? (await db.select({ id: users.id, name: users.name, email: users.email, phone: users.phone, roles: users.roles }).from(users).where(and(inArray(users.id, [...recipientIds]), eq(users.active, true)))).filter((user) => user.roles.some((role) => internalEventRoles.has(role)))
        : []
      for (const recipient of recipients) {
        if (reminder.channels.includes('email') && recipient.email) {
          const ok = await sendEventEmail({ to: recipient.email, recipientName: recipient.name, subject: title, title, detailsHtml: `<p>${escapeHtml(message)}</p>`, ctaLabel: 'Open internal event record', ctaHref: internalUrl })
          await db.insert(eventCommunications).values({ eventId: event.id, channel: 'email', audience: `internal:${recipient.id}`, messageType: reminder.reminderType, subject: title, body: message, status: ok ? 'sent' : 'failed', recipientCount: 1, sentCount: ok ? 1 : 0, failedCount: ok ? 0 : 1 })
          if (ok) messagesSent += 1
        }
        if (reminder.channels.includes('sms') && recipient.phone) {
          let sent = false
          try { await sendSms({ to: recipient.phone, body: message, contactName: recipient.name }); sent = true; messagesSent += 1 } catch (error) { console.error('Internal event reminder SMS failed:', error) }
          await db.insert(eventCommunications).values({ eventId: event.id, channel: 'sms', audience: `internal:${recipient.id}`, messageType: reminder.reminderType, body: message, status: sent ? 'sent' : 'failed', recipientCount: 1, sentCount: sent ? 1 : 0, failedCount: sent ? 0 : 1 })
        }
      }
    } else {
      const participants = await db.select({ participant: eventParticipants, contact: communityContacts }).from(eventParticipants).innerJoin(communityContacts, eq(eventParticipants.communityContactId, communityContacts.id)).where(and(eq(eventParticipants.eventId, event.id), eq(eventParticipants.rsvpStatus, 'confirmed')))
      const recipients = reminder.reminderType === 'thank_you' ? participants.filter(({ participant }) => participant.attendanceStatus === 'checked_in') : participants
      for (const { participant, contact } of recipients) {
        if (reminder.channels.includes('email') && (contact.status === 'subscribed' || participant.marketingConsent)) {
          const ok = await sendEventEmail({ to: contact.email, recipientName: `${contact.firstName} ${contact.lastName}`, subject: title, title, detailsHtml: `<p>${escapeHtml(message)}</p>`, ctaLabel: 'View event', ctaHref: publicUrl })
          await db.insert(eventCommunications).values({ eventId: event.id, channel: 'email', audience: `participant:${participant.id}`, messageType: reminder.reminderType, subject: title, body: message, status: ok ? 'sent' : 'failed', recipientCount: 1, sentCount: ok ? 1 : 0, failedCount: ok ? 0 : 1 })
          if (ok) messagesSent += 1
        }
        if (reminder.channels.includes('sms') && (participant.smsConsent || contact.smsConsentAt)) {
          let sent = false
          try { await sendSms({ to: contact.phone, body: message, contactName: `${contact.firstName} ${contact.lastName}` }); sent = true; messagesSent += 1 } catch (error) { console.error('Automated event SMS failed:', error) }
          await db.insert(eventCommunications).values({ eventId: event.id, channel: 'sms', audience: `participant:${participant.id}`, messageType: reminder.reminderType, body: message, status: sent ? 'sent' : 'failed', recipientCount: 1, sentCount: sent ? 1 : 0, failedCount: sent ? 0 : 1 })
        }
      }
    }

    await db.update(eventReminders).set({ lastSentAt: now, updatedAt: now }).where(eq(eventReminders.id, reminder.id))
    const reminderMessageCount = messagesSent - sentBefore
    await logActivityEvent({ entityType: 'event', entityId: event.id, kind: 'event_automated_reminder_sent', title, body: `${reminderMessageCount} message${reminderMessageCount === 1 ? '' : 's'} sent to ${internal ? 'internal team' : 'participants'}.` })
    remindersSent += 1
  }
  return NextResponse.json({ candidates: due.length, remindersSent, messagesSent })
}
