export const EASTERN_TIME_ZONE = 'America/New_York'

function coerceValidDate(value: Date | string | null | undefined) {
  if (!value) return null
  const parsed = typeof value === 'string' ? new Date(value) : value
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function getFormatter(
  options: Intl.DateTimeFormatOptions,
  timeZone = EASTERN_TIME_ZONE,
) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    ...options,
  })
}

function getTimeZoneParts(date: Date, timeZone = EASTERN_TIME_ZONE) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })

  const parts = formatter.formatToParts(date)
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]))

  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  }
}

function getTimeZoneOffsetMs(date: Date, timeZone = EASTERN_TIME_ZONE) {
  const parts = getTimeZoneParts(date, timeZone)
  const zonedUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
  return zonedUtc - date.getTime()
}

export function parseDateTimeInTimeZone(
  dateInput: string,
  timeInput: string,
  timeZone = EASTERN_TIME_ZONE,
) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateInput)
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(timeInput)
  if (!match || !timeMatch) {
    return new Date(Number.NaN)
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const hour = Number(timeMatch[1])
  const minute = Number(timeMatch[2])

  if (month < 1 || month > 12 || day < 1 || hour > 23 || minute > 59
    || new Date(Date.UTC(year, month - 1, day)).getUTCDate() !== day) return new Date(Number.NaN)
  try { new Intl.DateTimeFormat('en-US', { timeZone }) } catch { return new Date(Number.NaN) }

  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0)
  let offset = getTimeZoneOffsetMs(new Date(utcGuess), timeZone)
  let actual = utcGuess - offset
  const adjustedOffset = getTimeZoneOffsetMs(new Date(actual), timeZone)
  if (adjustedOffset !== offset) {
    offset = adjustedOffset
    actual = utcGuess - offset
  }

  const result = new Date(actual)
  const parts = getTimeZoneParts(result, timeZone)
  // Reject nonexistent wall times (the spring DST gap), rather than silently moving the booking.
  if (parts.year !== year || parts.month !== month || parts.day !== day || parts.hour !== hour || parts.minute !== minute) return new Date(Number.NaN)
  // Fall-back wall times occur twice. Require a different, unambiguous time.
  for (const delta of [-3600000, 3600000]) {
    const other = getTimeZoneParts(new Date(actual + delta), timeZone)
    if (other.year === year && other.month === month && other.day === day && other.hour === hour && other.minute === minute) return new Date(Number.NaN)
  }
  return result
}

export function formatEasternDate(date: Date | string, timeZone = EASTERN_TIME_ZONE) {
  const parsed = coerceValidDate(date)
  if (!parsed) return 'Date unavailable'
  return getFormatter({ dateStyle: 'medium' }, timeZone).format(parsed)
}

export function formatEasternTime(date: Date | string, timeZone = EASTERN_TIME_ZONE) {
  const parsed = coerceValidDate(date)
  if (!parsed) return 'Time unavailable'
  return getFormatter({ hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }, timeZone).format(parsed)
}

export function formatEasternTimeInput(date: Date | string) {
  const parsed = coerceValidDate(date)
  if (!parsed) return ''
  const parts = getTimeZoneParts(parsed)
  return `${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`
}

export function formatEasternDateTime(date: Date | string, timeZone = EASTERN_TIME_ZONE) {
  const parsed = coerceValidDate(date)
  if (!parsed) return 'Date unavailable'
  return `${getFormatter({ dateStyle: 'medium', timeStyle: 'short' }, timeZone).format(parsed)} (${timeZone})`
}

export function formatEasternTimeRange(start: Date | string, end: Date | string | null, timeZone = EASTERN_TIME_ZONE) {
  const parsedStart = coerceValidDate(start)
  if (!parsedStart) return 'Time unavailable'
  if (!end) return formatEasternTime(parsedStart, timeZone)
  const parsedEnd = coerceValidDate(end)
  if (!parsedEnd) return formatEasternTime(parsedStart, timeZone)

  const fmt = (h: number, m: number) => {
    const period = h >= 12 ? 'PM' : 'AM'
    const hour = h % 12 || 12
    const mins = m === 0 ? '' : `:${String(m).padStart(2, '0')}`
    return { label: `${hour}${mins}`, period }
  }

  const sp = getTimeZoneParts(parsedStart, timeZone)
  const ep = getTimeZoneParts(parsedEnd, timeZone)
  const zoneLabel = getFormatter({ timeZoneName: 'short' }, timeZone).formatToParts(parsedStart).find(part => part.type === 'timeZoneName')?.value ?? timeZone
  const s = fmt(sp.hour, sp.minute)
  const e = fmt(ep.hour, ep.minute)

  return s.period === e.period
    ? `${s.label}–${e.label} ${s.period} ${zoneLabel}`
    : `${s.label} ${s.period}–${e.label} ${e.period} ${zoneLabel}`
}

export function getEasternDateKey(date: Date | string, timeZone = EASTERN_TIME_ZONE) {
  const parsed = coerceValidDate(date)
  if (!parsed) return ''
  const parts = getTimeZoneParts(parsed, timeZone)
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`
}
