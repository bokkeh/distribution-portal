import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { tasterAvailability } from '@/db/schema'
import { requireFeature } from '@/lib/auth/session'
import { TasterAvailabilityEditor } from '@/components/tastings/TasterAvailabilityEditor'

function isMissingAvailabilityTable(error: unknown) {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase()
  return (
    message.includes('taster_availability') &&
    (
      message.includes('does not exist') ||
      message.includes('failed query')
    )
  )
}

export default async function TasterAvailabilityPage() {
  const session = await requireFeature('tastings', 'taster', 'admin')

  try {
    const availability = await db
      .select({ availableDate: tasterAvailability.availableDate })
      .from(tasterAvailability)
      .where(eq(tasterAvailability.userId, session.user.id))

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Availability</h1>
          <p className="mt-1 text-sm text-slate-500">Submit the days you can work tastings so the team can plan the next several months with real availability.</p>
        </div>
        <TasterAvailabilityEditor submittedDates={availability.map((row) => row.availableDate)} />
      </div>
    )
  } catch (error) {
    if (!isMissingAvailabilityTable(error)) throw error

    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-slate-900">My Availability</h1>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          The taster availability table is not in this database yet. Run `npm run db:migrate` before using availability scheduling in production.
        </div>
      </div>
    )
  }
}
