import { and, gte, lte, ne } from 'drizzle-orm'
import { orders } from '@/db/schema/orders'
import { parseDateTimeInTimeZone } from '@/lib/tastings/time'

export const ACCOUNT_REVENUE_DEFINITION = 'USD wholesale order totals; all non-cancelled orders, including pending orders. This is booked revenue, not payments received or consumer sell-through.'

export function getReportDateRange(from?: string, to?: string) {
  const valid = (value?: string) => value && Number.isFinite(parseDateTimeInTimeZone(value, '00:00').getTime()) ? value : undefined
  const fromInput = valid(from)
  const toInput = valid(to)
  const nextDay = toInput ? new Date(`${toInput}T12:00:00Z`) : null
  if (nextDay) nextDay.setUTCDate(nextDay.getUTCDate() + 1)
  return {
    fromInput, toInput,
    fromDate: fromInput ? parseDateTimeInTimeZone(fromInput, '00:00') : null,
    toDate: nextDay ? new Date(parseDateTimeInTimeZone(nextDay.toISOString().slice(0, 10), '00:00').getTime() - 1) : null,
  }
}

export function accountRevenueFilter(fromDate: Date | null, toDate: Date | null) {
  return and(ne(orders.status, 'cancelled'), fromDate ? gte(orders.createdAt, fromDate) : undefined, toDate ? lte(orders.createdAt, toDate) : undefined)
}
