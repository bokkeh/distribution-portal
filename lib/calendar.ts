export function buildGoogleCalendarUrl({
  title,
  details,
  location,
  start,
  end,
}: {
  title: string
  details?: string
  location?: string
  start: Date
  end: Date
}) {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${toGoogleDate(start)}/${toGoogleDate(end)}`,
  })

  if (details) params.set('details', details)
  if (location) params.set('location', location)

  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

function toGoogleDate(value: Date) {
  return value.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

export function buildIcsFile({
  title,
  description,
  location,
  start,
  end,
}: {
  title: string
  description?: string
  location?: string
  start: Date
  end: Date
}) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//AHAWC//Distribution Portal//EN',
    'BEGIN:VEVENT',
    `UID:${crypto.randomUUID()}`,
    `DTSTAMP:${toGoogleDate(new Date())}`,
    `DTSTART:${toGoogleDate(start)}`,
    `DTEND:${toGoogleDate(end)}`,
    `SUMMARY:${escapeIcs(title)}`,
    description ? `DESCRIPTION:${escapeIcs(description)}` : '',
    location ? `LOCATION:${escapeIcs(location)}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean)

  return `${lines.join('\r\n')}\r\n`
}

function escapeIcs(value: string) {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll('\n', '\\n')
    .replaceAll(',', '\\,')
    .replaceAll(';', '\\;')
}
