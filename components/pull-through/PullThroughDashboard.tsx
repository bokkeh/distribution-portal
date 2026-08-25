import Link from 'next/link'
import { AlertTriangle, TrendingUp, Users, Wine } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { KpiStrip } from '@/components/pull-through/KpiStrip'
import { PullThroughFilterBar } from '@/components/pull-through/PullThroughFilterBar'
import { PullThroughTable } from '@/components/pull-through/PullThroughTable'
import { loadPullThroughDataset, pullThroughBasePath, type PullThroughScope } from '@/lib/pull-through/data'
import { applyFilters, collectFilterOptions, computeKpis, parseFilters } from '@/lib/pull-through/filters'

/**
 * Account Pull-Through dashboard.
 *
 * One row per existing account. Everything shown is recomputed on each request from
 * connected order, tasting, inventory and CRM records, so there is no "refresh report"
 * step and no stored copy of any metric.
 */
export async function PullThroughDashboard({
  scope,
  searchParams,
  showTeamLinks,
}: {
  scope: PullThroughScope
  searchParams: Record<string, string | string[] | undefined>
  showTeamLinks: boolean
}) {
  const basePath = pullThroughBasePath(scope.mode)
  const dataset = await loadPullThroughDataset(scope)
  const filters = parseFilters(searchParams)
  const filtered = applyFilters(dataset.rows, filters, dataset.tasterNamesByAccount)

  // KPIs describe the viewer's whole book, not the current filter, so the headline
  // numbers stay stable while drilling in.
  const kpis = computeKpis(dataset.rows, basePath)
  const options = collectFilterOptions(dataset.rows)
  const tasters = Array.from(new Set(Array.from(dataset.tasterNamesByAccount.values()).flat())).sort((a, b) =>
    a.localeCompare(b),
  )

  const dataGapCount = dataset.rows.reduce((sum, row) => sum + row.dataQuality.length, 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Account Pull-Through</h1>
          <p className="mt-1 text-muted-foreground">
            {scope.viewerLabel} · {dataset.rows.length} account{dataset.rows.length === 1 ? '' : 's'} · calculated live
            from orders, tastings, inventory checks and CRM activity.
          </p>
        </div>
        {showTeamLinks && (
          <div className="flex flex-wrap gap-2">
            <Link
              href={`${basePath}/tasters`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Wine className="h-4 w-4" />
              Taster Performance
            </Link>
            <Link
              href={`${basePath}/reps`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Users className="h-4 w-4" />
              Sales Rep Performance
            </Link>
          </div>
        )}
      </div>

      {dataset.rows.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <TrendingUp className="mx-auto mb-3 h-10 w-10 text-slate-300" />
            <p className="font-medium text-slate-700">No accounts in scope.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Accounts appear here once they are assigned to you in the CRM.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <KpiStrip kpis={kpis} />

          <PullThroughFilterBar options={{ ...options, tasters }} basePath={basePath} />

          {dataGapCount > 0 && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <p className="text-sm text-amber-800">
                <span className="font-semibold">{dataGapCount} data gap{dataGapCount === 1 ? '' : 's'}</span> across these
                accounts. Open any recommended action to see what is missing and jump to the record that fixes it.
              </p>
            </div>
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Accounts</CardTitle>
              <p className="text-xs text-muted-foreground">
                Click an account name to open its existing CRM record. Every figure below links back to the record it
                came from.
              </p>
            </CardHeader>
            <CardContent className="p-0">
              <PullThroughTable rows={filtered} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
