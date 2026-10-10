import { and, inArray, sql } from 'drizzle-orm'
import { tastings } from '@/db/schema/tastings'

/** Filter before ordering/limiting so distant events cannot displace nearer bookings. */
export function upcomingTastingFilter(now = new Date()) {
  return and(
    inArray(tastings.status, ['requested', 'scheduled', 'confirmed']),
    sql`COALESCE(${tastings.endAt}, ${tastings.scheduledAt} + interval '2 hours') > ${now.toISOString()}::timestamptz`,
  )
}
