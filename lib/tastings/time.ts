export const EASTERN_TIME_ZONE = 'America/New_York'

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

  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0)
  let offset = getTimeZoneOffsetMs(new Date(utcGuess), timeZone)
  let actual = utcGuess - offset
  const adjustedOffset = getTimeZoneOffsetMs(new Date(actual), timeZone)
  if (adjustedOffset !== offset) {
    offset = adjustedOffset
    actual = utcGuess - offset
  }

  return new Date(actual)
}

export function formatEasternDate(date: Date | string) {
  const parsed = typeof date === 'string' ? new Date(date) : date
  return getFormatter({ dateStyle: 'medium' }).format(parsed)
}

export function formatEasternTime(date: Date | string) {
  const parsed = typeof date === 'string' ? new Date(date) : date
  return `${getFormatter({ timeStyle: 'short' }).format(parsed)} ET`
}

export function formatEasternTimeInput(date: Date | string) {
  const parsed = typeof date === 'string' ? new Date(date) : date
  const parts = getTimeZoneParts(parsed)
  return `${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`
}

export function formatEasternDateTime(date: Date | string) {
  const parsed = typeof date === 'string' ? new Date(date) : date
  return `${getFormatter({ dateStyle: 'medium', timeStyle: 'short' }).format(parsed)} ET`
}

export function formatEasternTimeRange(start: Date | string, end: Date | string | null) {
  const parsedStart = typeof start === 'string' ? new Date(start) : start
  if (!end) return formatEasternTime(parsedStart)
  const parsedEnd = typeof end === 'string' ? new Date(end) : end

  const fmt = (h: number, m: number) => {
    const period = h >= 12 ? 'PM' : 'AM'
    const hour = h % 12 || 12
    const mins = m === 0 ? '' : `:${String(m).padStart(2, '0')}`
    return { label: `${hour}${mins}`, period }
  }

  const sp = getTimeZoneParts(parsedStart)
  const ep = getTimeZoneParts(parsedEnd)
  const s = fmt(sp.hour, sp.minute)
  const e = fmt(ep.hour, ep.minute)

  return s.period === e.period
    ? `${s.label}–${e.label} ${s.period} ET`
    : `${s.label} ${s.period}–${e.label} ${e.period} ET`
}

export function getEasternDateKey(date: Date | string) {
  const parsed = typeof date === 'string' ? new Date(date) : date
  const parts = getTimeZoneParts(parsed)
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`
}
