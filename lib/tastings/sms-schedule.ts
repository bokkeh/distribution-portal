import { formatEasternTimeInput, getEasternDateKey, parseDateTimeInTimeZone } from './time'

export const SCHEDULED_TASTING_SMS_KEYS = ['day_before_reminder', 'day_of_reminder', 'checkin_prompt', 'mid_event_check', 'end_of_tasting'] as const
export type ScheduledTastingSmsKey = typeof SCHEDULED_TASTING_SMS_KEYS[number]

export function getTastingSmsSchedule(start: Date, end: Date | null) {
  const finish = end ?? new Date(start.getTime() + 2 * 3600000)
  const previousDay = new Date(`${getEasternDateKey(start)}T12:00:00Z`)
  previousDay.setUTCDate(previousDay.getUTCDate() - 1)
  return {
    day_before_reminder: parseDateTimeInTimeZone(previousDay.toISOString().slice(0, 10), formatEasternTimeInput(start)),
    day_of_reminder: new Date(Math.max(parseDateTimeInTimeZone(getEasternDateKey(start), '09:00').getTime(), start.getTime() - 2 * 3600000)),
    checkin_prompt: start,
    mid_event_check: new Date(start.getTime() + Math.max(30, Math.round((finish.getTime() - start.getTime()) / 120000)) * 60000),
    end_of_tasting: finish,
  }
}

export function getTastingSmsDisposition(key: ScheduledTastingSmsKey, start: Date, end: Date | null, now: Date) {
  const schedule = getTastingSmsSchedule(start, end)
  const due = schedule[key]
  if (now < due) return 'reschedule'
  const finish = schedule.end_of_tasting
  if (key === 'day_before_reminder') return getEasternDateKey(now) === getEasternDateKey(due) && now < start ? 'send' : 'cancel'
  if (key === 'end_of_tasting') return now.getTime() - finish.getTime() <= 3600000 ? 'send' : 'cancel'
  if (now >= finish) return 'cancel'
  if (getEasternDateKey(now) !== getEasternDateKey(start)) return 'cancel'
  if (key === 'day_of_reminder') return now < start ? 'send' : 'cancel'
  if (key === 'checkin_prompt') return now < schedule.mid_event_check ? 'send' : 'cancel'
  return now < finish ? 'send' : 'cancel'
}
