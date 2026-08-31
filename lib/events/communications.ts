import 'server-only'
import { sendEventEmail } from '@/lib/resend/client'
import { sendSms } from '@/lib/telnyx/client'
import { formatEventDateTime, getDirectionsUrl, getEventAddress, getEventPublicUrl } from './utils'

type EventMessageRecord = {
  slug: string
  title: string
  startAt: Date
  timeZone: string
  venueName: string | null
  addressLine1: string | null
  addressLine2: string | null
  city: string | null
  state: string | null
  postalCode: string | null
  country: string | null
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export async function sendEventConfirmation(input: {
  event: EventMessageRecord
  participant: { managementToken: string; smsConsent: boolean }
  contact: { firstName: string; lastName: string; email: string; phone: string }
}) {
  const address = getEventAddress(input.event)
  const eventUrl = getEventPublicUrl(input.event.slug)
  const manageUrl = `${eventUrl}/rsvp/${input.participant.managementToken}`
  const calendarUrl = `${getEventPublicUrl(input.event.slug).replace(`/events/${input.event.slug}`, '')}/api/events/${input.event.slug}/calendar`
  const dateLabel = formatEventDateTime(input.event.startAt, input.event.timeZone)
  const directionsUrl = getDirectionsUrl(address)
  const fullName = `${input.contact.firstName} ${input.contact.lastName}`.trim()

  const emailSent = await sendEventEmail({
    to: input.contact.email,
    recipientName: fullName,
    subject: `You're confirmed for ${input.event.title}`,
    title: `You're confirmed for ${input.event.title}`,
    intro: `Hi ${input.contact.firstName}, we look forward to seeing you.`,
    detailsHtml: `<p><strong>Date:</strong> ${escapeHtml(dateLabel)}</p><p><strong>Location:</strong> ${escapeHtml(address || 'Details coming soon')}</p><p><a href="${directionsUrl}">Get directions</a> &nbsp;·&nbsp; <a href="${calendarUrl}">Add to calendar</a></p>`,
    ctaLabel: 'View event & manage RSVP',
    ctaHref: manageUrl,
  })

  let smsSent = false
  if (input.participant.smsConsent) {
    try {
      await sendSms({
        to: input.contact.phone,
        body: `You're confirmed for ${input.event.title} on ${dateLabel}. Details + directions: ${eventUrl}`,
        contactName: fullName,
      })
      smsSent = true
    } catch (error) {
      console.error('Event confirmation SMS failed:', error)
    }
  }

  return { emailSent, smsSent }
}
