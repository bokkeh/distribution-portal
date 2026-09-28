import Link from 'next/link'
import { requireAdminOrStaff } from '@/lib/auth/session'
import { getDashboardSummary, syncProgressionNotifications } from '@/actions/progression'
import { StatTile } from '@/components/progression/shared'
import { ProgressionLadder } from '@/components/progression/Ladder'
import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'

export default async function TeamProgressionDashboardPage() {
  await requireAdminOrStaff()
  await syncProgressionNotifications().catch(() => {})
  const summary = await getDashboardSummary()

  const counts = new Map(summary.byLevel.map(l => [l.level, l.count]))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Team Progression</h1>
          <p className="mt-1 text-slate-500">Wisher Vodka tasting &amp; sales rank ladder — First Pour to Global Ambassador.</p>
        </div>
        {summary.permissions.canExportReports && (
          <a href="/api/progression/export/roster">
            <Button variant="outline"><Download className="mr-2 h-4 w-4" />Export roster CSV</Button>
          </a>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile label="Active team members" value={summary.totalActive} href="/admin/team-progression/roster" />
        <StatTile label="Eligible for promotion" value={summary.eligibleForPromotion} href="/admin/team-progression/roster?eligibility=eligible_for_review" />
        <StatTile label="Reviews overdue" value={summary.reviewsOverdue} />
        <StatTile label="Tastings this month" value={summary.tastingsThisMonth} />
        <StatTile label="Training sessions this month" value={summary.trainingSessionsThisMonth} />
        <StatTile label="Bottles sold this month" value={summary.bottlesSoldThisMonth} />
        <StatTile label="Cases sold this month" value={summary.casesSoldThisMonth} />
        <StatTile label="Accounts opened this month" value={summary.accountsOpenedThisMonth} />
        <StatTile label="Reorders influenced" value={summary.reordersInfluencedTotal} sublabel="all time" />
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Rank ladder</h2>
          <Link href="/admin/team-progression/roster" className="text-sm font-medium text-blue-600 hover:underline">View full roster →</Link>
        </div>
        <ProgressionLadder counts={counts} rosterHref="/admin/team-progression/roster" />
      </div>
    </div>
  )
}
