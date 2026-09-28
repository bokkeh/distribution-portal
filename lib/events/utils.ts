export const EVENT_TYPES = [
  ['party', 'Party'],
  ['pop_up', 'Pop-up'],
  ['festival', 'Festival'],
  ['community_event', 'Community Event'],
  ['retail_activation', 'Retail Activation'],
  ['partner_event', 'Partner Event'],
  ['dinner', 'Dinner'],
  ['sponsorship', 'Sponsorship'],
  ['sports_event', 'Sports Event'],
  ['trade_event', 'Trade Event'],
  ['other', 'Other'],
] as const

export const RSVP_OPTIONAL_FIELDS = [
  ['guest_names', 'Guest names'],
  ['company', 'Company'],
  ['instagram', 'Instagram handle'],
  ['notes', 'Notes'],
  ['marketing_consent', 'Marketing consent'],
  ['sms_consent', 'SMS consent'],
] as const

export type EventLifecycleBucket = 'upcoming' | 'past' | 'draft' | 'cancelled'

type EventMinimumFields = {
  title?: string | null
  startAt?: Date | null
  endAt?: Date | null
  accountId?: string | null
  venueName?: string | null
  addressLine1?: string | null
  city?: string | null
}

export function getEventDraftReasons(event: EventMinimumFields) {
  const reasons: string[] = []
  if (!event.title?.trim()) reasons.push('event name')
  if (!event.startAt) reasons.push('event date and start time')
  if (!event.endAt) reasons.push('end time')
  if (event.startAt && event.endAt && event.endAt <= event.startAt) reasons.push('an end time after the start')
  if (!event.accountId && !event.venueName?.trim() && !event.addressLine1?.trim() && !event.city?.trim()) reasons.push('location')
  return reasons
}

export function hasEventMinimumDetails(event: EventMinimumFields) {
  return getEventDraftReasons(event).length === 0
}

export function getEventLifecycleBucket(
  event: EventMinimumFields & { status: string },
  now = new Date(),
): EventLifecycleBucket {
  if (event.status === 'cancelled') return 'cancelled'
  if (event.status === 'completed') return 'past'
  if (event.status === 'draft' || !hasEventMinimumDetails(event)) return 'draft'
  return event.endAt && event.endAt < now ? 'past' : 'upcoming'
}

export function getEventPlanningCompletion(event: {
  organizerUserId?: string | null
  teamArrivalAt?: Date | null
  setupAt?: Date | null
  breakdownAt?: Date | null
  planningPocName?: string | null
  planningPocContactId?: string | null
  dayOfPocName?: string | null
  dayOfPocContactId?: string | null
  expectedAttendees?: number | null
  estimatedPeopleServed?: number | null
  cocktailsServed?: string[] | null
  productIds?: string[] | null
  estimatedProductRequired?: string | null
  wisherProvides?: string[] | null
  partnerProvides?: string[] | null
  assignedTeamMemberIds?: string[] | null
}) {
  const checks = [
    Boolean(event.organizerUserId),
    Boolean(event.teamArrivalAt && event.setupAt && event.breakdownAt),
    Boolean(event.planningPocContactId || event.planningPocName),
    Boolean(event.dayOfPocContactId || event.dayOfPocName),
    event.expectedAttendees != null || event.estimatedPeopleServed != null,
    Boolean(event.cocktailsServed?.length || event.productIds?.length || event.estimatedProductRequired?.trim()),
    Boolean(event.wisherProvides?.length && event.partnerProvides?.length),
    Boolean(event.assignedTeamMemberIds?.length),
  ]
  return Math.round((checks.filter(Boolean).length / checks.length) * 100)
}

export function parseEventList(value: string) {
  return [...new Set(value.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean))].slice(0, 100)
}

export function slugifyEventTitle(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72) || 'event'
}

export function getEventAddress(event: {
  venueName?: string | null
  addressLine1?: string | null
  addressLine2?: string | null
  city?: string | null
  state?: string | null
  postalCode?: string | null
  country?: string | null
}) {
  return [event.venueName, event.addressLine1, event.addressLine2, event.city, event.state, event.postalCode, event.country]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(', ')
}

export function getDirectionsUrl(address: string) {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`
}

export function getEventBaseUrl() {
  return (process.env.NEXTAUTH_URL ?? 'https://ahawc.com').replace(/\/$/, '')
}

export function getEventPublicUrl(slug: string) {
  return `${getEventBaseUrl()}/events/${slug}`
}

export function parseGuestNames(value: string) {
  return value.split(/[\n,]/).map((name) => name.trim()).filter(Boolean).slice(0, 20)
}

export function formatEventDateTime(value: Date, timeZone: string) {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone,
  }).format(value)
}

export function localEventDateTimeToUtc(date: string, time: string, timeZone: string) {
  const desired = Date.parse(`${date}T${time}:00Z`)
  if (!Number.isFinite(desired)) throw new Error('Enter a valid event date and time.')

  let candidate = desired
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(candidate))
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
    const represented = Date.parse(`${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}:00Z`)
    candidate += desired - represented
  }
  return new Date(candidate)
}
