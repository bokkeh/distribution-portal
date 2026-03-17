import Link from 'next/link'
import { requireFeature } from '@/lib/auth/session'
import { getTastingsForView } from '@/actions/tastings'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatEasternDateTime } from '@/lib/tastings/time'

function isMissingTastingsTable(error: unknown) {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase()
  return (
    (message.includes('tastings') && message.includes('does not exist')) ||
    (message.includes('tasting_reports') && message.includes('does not exist')) ||
    (message.includes('taster_invoices') && message.includes('does not exist'))
  )
}

export default async function TasterTastingReportsPage() {
  const session = await requireFeature('tastings', 'taster', 'admin')

  try {
    const tastings = await getTastingsForView({ assignedUserId: session.user.id })
    const reportRows = tastings
      .filter((tasting) => tasting.reportSubmittedAt)
      .sort((a, b) => new Date(b.reportSubmittedAt ?? 0).getTime() - new Date(a.reportSubmittedAt ?? 0).getTime())

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Tasting Reports</h1>
            <p className="mt-1 text-muted-foreground">Review every submitted tasting report and jump back into the full tasting detail when needed.</p>
          </div>
          <Link href="/taster/tastings">
            <Button variant="outline">Back To Tastings</Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Submitted Reports</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {reportRows.length ? reportRows.map((tasting) => (
              <div key={tasting.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="font-semibold text-slate-900">{tasting.eventName}</p>
                    <p className="text-sm text-slate-500">Scheduled {formatEasternDateTime(new Date(tasting.scheduledAt))}</p>
                    <p className="text-sm text-slate-500">Report submitted {formatEasternDateTime(new Date(tasting.reportSubmittedAt!))}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="success">Report Submitted</Badge>
                    {tasting.invoiceSubmittedAt ? <Badge variant="info">Invoice Submitted</Badge> : null}
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href={`/taster/tastings/${tasting.id}#report`}>
                    <Button size="sm">Review Report</Button>
                  </Link>
                  <Link href={`/taster/tastings/${tasting.id}`}>
                    <Button size="sm" variant="outline">Open Full Tasting</Button>
                  </Link>
                </div>
              </div>
            )) : (
              <p className="text-sm text-slate-500">No tasting reports have been submitted yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    )
  } catch (error) {
    if (!isMissingTastingsTable(error)) throw error

    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-slate-900">Tasting Reports</h1>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          The tasting report tables are not in this database yet. Run `npm run db:migrate` before using tasting reporting in production.
        </div>
      </div>
    )
  }
}
