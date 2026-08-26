const AVAILABILITY_TIME_ZONE = 'America/New_York'

type CalendarDate = {
  year: number
  month: number
  day: number
}

function calendarDateInTimeZone(date: Date, timeZone: string): CalendarDate {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)

  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value)

  return {
    year: value('year'),
    month: value('month'),
    day: value('day'),
  }
}

function formatCalendarDate(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date)
}

export function getAvailabilityReminderSchedule(
  now = new Date(),
  timeZone = AVAILABILITY_TIME_ZONE,
) {
  const current = calendarDateInTimeZone(now, timeZone)
  const currentDate = new Date(Date.UTC(current.year, current.month - 1, current.day))
  const deadline = new Date(Date.UTC(current.year, current.month, 0))
  const reminderDate = new Date(deadline)
  reminderDate.setUTCDate(deadline.getUTCDate() - 7)

  return {
    isDue: currentDate.getTime() === reminderDate.getTime(),
    periodKey: `${current.year}-${String(current.month).padStart(2, '0')}`,
    deadline,
    deadlineLabel: formatCalendarDate(deadline),
    reminderDate,
    reminderDateLabel: formatCalendarDate(reminderDate),
  }
}

export function getTasterAvailabilityUrl() {
  const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL
  const baseUrl = productionHost
    ? `https://${productionHost}`
    : (process.env.NEXTAUTH_URL ?? 'https://portal.ahawc.com')

  return `${baseUrl.replace(/\/$/, '')}/taster/availability`
}

export function getAvailabilityReminderSubject(deadlineLabel: string) {
  return `Taster availability due by ${deadlineLabel}`
}

export function getAvailabilityReminderSms(deadlineLabel: string, availabilityUrl: string) {
  return `AHAWC reminder: Please submit your upcoming tasting availability by ${deadlineLabel}: ${availabilityUrl}`
}
