export const DEFAULT_TIME_ZONE = 'America/New_York'

export const COMMON_TIME_ZONES = [
  { value: 'America/New_York', label: 'Eastern Time' },
  { value: 'America/Chicago', label: 'Central Time' },
  { value: 'America/Denver', label: 'Mountain Time' },
  { value: 'America/Los_Angeles', label: 'Pacific Time' },
  { value: 'America/Phoenix', label: 'Arizona Time' },
  { value: 'America/Anchorage', label: 'Alaska Time' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time' },
] as const

export function formatDateTimeInTimeZone(date: Date | string, timeZone = DEFAULT_TIME_ZONE) {
  const parsed = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed)
}

export function formatDateInTimeZone(date: Date | string, timeZone = DEFAULT_TIME_ZONE) {
  const parsed = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    dateStyle: 'medium',
  }).format(parsed)
}

export function formatTimeInTimeZone(date: Date | string, timeZone = DEFAULT_TIME_ZONE) {
  const parsed = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeStyle: 'short',
  }).format(parsed)
}

export function getShortTimeZoneLabel(timeZone = DEFAULT_TIME_ZONE) {
  const match = COMMON_TIME_ZONES.find((item) => item.value === timeZone)
  return match?.label ?? timeZone
}
