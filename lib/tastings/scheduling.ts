import { z } from 'zod'
import { parseDateTimeInTimeZone } from './time'

export const quickScheduleSchema = z.object({
  requestId: z.string().uuid(),
  accountId: z.string().uuid().nullable(),
  venueName: z.string().trim().max(200).default(''),
  venueAddress: z.string().trim().max(300).default(''),
  venueCity: z.string().trim().max(100).default(''),
  venueState: z.string().trim().max(100).default(''),
  venueZip: z.string().trim().max(30).default(''),
  locationIndex: z.number().int().nonnegative().default(0),
  date: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  timeZone: z.string().default('America/New_York'),
  assignedUserId: z.string().uuid().nullable(),
  notes: z.string().trim().max(5000).default(''),
  contact: z.string().trim().max(300).default(''),
}).superRefine((input, ctx) => {
  if (!input.accountId && !input.venueName) ctx.addIssue({ code: 'custom', message: 'Choose an account or enter a venue name.', path: ['venueName'] })
  const start = parseDateTimeInTimeZone(input.date, input.startTime, input.timeZone)
  const end = parseDateTimeInTimeZone(input.date, input.endTime, input.timeZone)
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) ctx.addIssue({ code: 'custom', message: 'Choose a valid date and local times. Daylight-saving gaps or repeated times need an unambiguous time.', path: ['date'] })
  else if (end <= start) ctx.addIssue({ code: 'custom', message: 'End time must be after start time.', path: ['endTime'] })
})

export type QuickScheduleInput = z.input<typeof quickScheduleSchema>

export function normalizeVenueIdentity(value: string) {
  return value.trim().normalize('NFKC').toLowerCase().replace(/[’']/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
}

export function isUpcomingTasting(tasting: { scheduledAt: Date | string; endAt?: Date | string | null; status: string }, now = Date.now()) {
  if (!['requested', 'scheduled', 'confirmed'].includes(tasting.status)) return false
  const start = new Date(tasting.scheduledAt).getTime()
  const end = tasting.endAt ? new Date(tasting.endAt).getTime() : start + 2 * 60 * 60 * 1000
  return Number.isFinite(start) && end > now
}

/** Repeated taps share one in-flight promise; callers keep their request id after an uncertain response. */
export function singleFlight<TArgs extends unknown[], TResult>(save: (...args: TArgs) => Promise<TResult>) {
  let pending: Promise<TResult> | null = null
  return (...args: TArgs) => {
    if (pending) return pending
    pending = save(...args).finally(() => { pending = null })
    return pending
  }
}
