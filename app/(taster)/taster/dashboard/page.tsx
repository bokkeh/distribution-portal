import Link from 'next/link'
import { eq } from 'drizzle-orm'
import { requireFeature } from '@/lib/auth/session'
import { getTastingsForView } from '@/actions/tastings'
import { db } from '@/db'
import { tastingReports } from '@/db/schema'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { TastingReportFormCard } from '@/components/tastings/TastingReportFormCard'
import { formatEasternDateTime } from '@/lib/tastings/time'

function isMissingTastingsTable(error: unknown) {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase()
  return (
    (message.includes('tastings') && message.includes('does not exist')) ||
    (message.includes('tasting_reports') && message.includes('does not exist')) ||
    (message.includes('taster_invoices') && message.includes('does not exist'))
  )
}

export default async function TasterDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>
}) {
  const session = await requireFeature('tastings', 'taster', 'admin')
  const params = await searchParams

  try {
    const tastings = await getTastingsForView({ assignedUserId: session.user.id })
    const reportsNeeded = tastings.filter((tasting) => tasting.status === 'completed' && !tasting.reportSubmittedAt)
    const submittedReports = tastings.filter((tasting) => tasting.reportSubmittedAt)
    const nextTasting = tastings.find((tasting) => new Date(tasting.scheduledAt) >= new Date())
    const featuredTasting = reportsNeeded[0] ?? nextTasting ?? null

    const report = featuredTasting
      ? await db.select().from(tastingReports).where(eq(tastingReports.tastingId, featuredTasting.id)).then((rows) => rows[0] ?? null)
      : null

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
            <p className="mt-1 text-muted-foreground">Stay on top of assigned tastings, reports due, and submitted event activity.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/taster/tastings">
              <Button variant="outline">All Tastings</Button>
            </Link>
            <Link href="/taster/tastings/reports">
              <Button>Review Reports</Button>
            </Link>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-slate-500">Upcoming Tastings</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-bold text-slate-900">{tastings.filter((tasting) => new Date(tasting.scheduledAt) >= new Date()).length}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-slate-500">Reports Due</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-bold text-amber-600">{reportsNeeded.length}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-slate-500">Reports Submitted</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-bold text-emerald-600">{submittedReports.length}</p></CardContent>
          </Card>
        </div>

        {featuredTasting ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm font-semibold text-slate-900">
                {reportsNeeded.length ? 'Report needing attention' : 'Next tasting'}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {featuredTasting.eventName} • {formatEasternDateTime(new Date(featuredTasting.scheduledAt))}
              </p>
            </div>
            <TastingReportFormCard
              tasting={{
                id: featuredTasting.id,
                eventName: featuredTasting.eventName,
                scheduledAt: new Date(featuredTasting.scheduledAt),
              }}
              report={report ? {
                actualStartTime: report.actualStartTime,
                actualEndTime: report.actualEndTime,
                samplesServed: report.samplesServed,
                bottlesSold: report.bottlesSold,
                casesSold: report.casesSold,
                consumerInteractions: report.consumerInteractions,
                accountFeedback: report.accountFeedback,
                highlights: report.highlights,
                issues: report.issues,
                followUpNeeded: report.followUpNeeded,
                followUpNotes: report.followUpNotes,
                submittedAt: report.submittedAt,
              } : null}
              success={params.success}
              error={params.error}
              compact
            />
            <Link href={`/taster/tastings/${featuredTasting.id}`}>
              <Button variant="outline">Open Full Tasting Details</Button>
            </Link>
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-sm text-slate-500">
              No tastings are assigned right now.
            </CardContent>
          </Card>
        )}
      </div>
    )
  } catch (error) {
    if (!isMissingTastingsTable(error)) throw error

    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          The tasting tables are not in this database yet. Run `npm run db:migrate` before using tasting scheduling in production.
        </div>
      </div>
    )
  }
}
