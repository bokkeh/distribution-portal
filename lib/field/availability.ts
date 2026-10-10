import { parseDateTimeInTimeZone, getEasternDateKey, formatEasternTimeRange } from '@/lib/tastings/time'

export type FieldAvailability = {
  tasters: { id: string; name: string }[]
  dates: { userId: string; date: string }[]
  bookings: { userId: string | null; start: string; end: string | null; timeZone: string }[]
}

export function fieldAvailabilityRows(data: FieldAvailability, startTime = '16:00', endTime = '19:00', timeZone = 'America/New_York') {
  return data.dates.map(row => {
    const start = parseDateTimeInTimeZone(row.date, startTime, timeZone), end = parseDateTimeInTimeZone(row.date, endTime, timeZone)
    const booked = data.bookings.filter(booking => booking.userId === row.userId && getEasternDateKey(booking.start, timeZone) === row.date)
    const conflict = data.bookings.some(booking => booking.userId === row.userId && new Date(booking.start) < end && new Date(booking.end ?? new Date(new Date(booking.start).getTime() + 7200000)) > start)
    return { ...row, name: data.tasters.find(taster => taster.id === row.userId)?.name ?? 'Taster', free: !conflict && Number.isFinite(start.getTime()) && end > start,
      bookedLabel: booked.map(booking => formatEasternTimeRange(booking.start, booking.end, timeZone)).join(', ') }
  })
}
