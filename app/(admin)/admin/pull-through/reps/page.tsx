import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { requireFeature } from '@/lib/auth/session'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { loadPullThroughDataset, pullThroughBasePath, resolvePullThroughScope } from '@/lib/pull-through/data'
import { computeRepPerformance } from '@/lib/pull-through/performance'
import { buildFilterQuery } from '@/lib/pull-through/filters'
import { INVENTORY_STALE_DAYS } from '@/lib/pull-through/metrics'
import { NOT_ENOUGH_DATA } from '@/lib/pull-through/display'

export default async function RepPerformancePage() {
  const session = await requireFeature('crm', 'admin', 'sales_manager')
  const scope = await resolvePullThroughScope(session)

  const basePath = pullThroughBasePath(scope.mode)
  const dataset = await loadPullThroughDataset(scope)
  const performance = computeRepPerformance(dataset.rows)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={basePath}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Sales Rep Performance</h1>
          <p className="mt-1 text-muted-foreground">
            Grouped by the sales member already assigned to each account in the CRM — no separate rep list.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Reps</CardTitle>
          <p className="text-xs text-muted-foreground">
            Inventory compliance is the share of a rep&apos;s accounts with an inventory check inside the last{' '}
            {INVENTORY_STALE_DAYS} days.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {performance.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No accounts in scope.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    {[
                      'Sales Rep',
                      'Accounts',
                      'Active',
                      'Hot',
                      'New',
                      'At Risk',
                      'Reorder Rate',
                      'Avg Reorder Freq.',
                      'Tastings Booked',
                      'Inv. Compliance',
                      'Avg Pull-Through',
                    ].map((label, index) => (
                      <th
                        key={label}
                        className={`whitespace-nowrap px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground ${
                          index === 0 ? 'text-left' : 'text-right'
                        }`}
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {performance.map((row) => {
                    const repFilter = row.salesRepId ?? 'unassigned'
                    return (
                      <tr key={repFilter} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                        <td className="px-3 py-3">
                          <Link
                            href={`${basePath}${buildFilterQuery({ rep: repFilter })}`}
                            className="font-medium text-slate-900 hover:text-blue-600 hover:underline"
                          >
                            {row.salesRepName}
                          </Link>
                        </td>
                        <td className="px-3 py-3 text-right font-semibold text-slate-900">{row.accountsManaged}</td>
                        <td className="px-3 py-3 text-right text-slate-700">{row.activeAccounts}</td>
                        <td className="px-3 py-3 text-right text-emerald-600">{row.hotAccounts}</td>
                        <td className="px-3 py-3 text-right text-slate-700">{row.newAccounts}</td>
                        <td className="px-3 py-3 text-right text-red-600">{row.atRiskAccounts}</td>
                        <td className="px-3 py-3 text-right text-slate-700">
                          {row.reorderRate == null ? '—' : `${row.reorderRate.toFixed(0)}%`}
                        </td>
                        <td className="px-3 py-3 text-right text-slate-700">
                          {row.avgReorderFrequency == null ? '—' : `${row.avgReorderFrequency.toFixed(0)}d`}
                        </td>
                        <td className="px-3 py-3 text-right text-slate-700">{row.tastingsBooked}</td>
                        <td className="px-3 py-3 text-right text-slate-700">
                          {row.inventoryCheckCompliance == null ? '—' : `${row.inventoryCheckCompliance.toFixed(0)}%`}
                        </td>
                        <td className="px-3 py-3 text-right text-slate-700">
                          {row.avgPullThroughScore == null ? (
                            <span className="text-[11px] text-slate-400">{NOT_ENOUGH_DATA}</span>
                          ) : (
                            row.avgPullThroughScore.toFixed(0)
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
