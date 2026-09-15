import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { requireFeature } from '@/lib/auth/session'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  attributedTastingsFromDataset,
  loadPullThroughDataset,
  pullThroughBasePath,
  resolvePullThroughScope,
  tastingDetailPath,
} from '@/lib/pull-through/data'
import { computeTasterPerformance } from '@/lib/pull-through/performance'
import { NOT_ENOUGH_DATA, fmtMoney, fmtPercent, fmtShortDate, moneyTone } from '@/lib/pull-through/display'
import { buildFilterQuery } from '@/lib/pull-through/filters'

export default async function TasterPerformancePage({
  searchParams,
}: {
  searchParams: Promise<{ taster?: string }>
}) {
  const session = await requireFeature('tastings', 'admin', 'sales_manager')
  const scope = await resolvePullThroughScope(session)
  const { taster: selectedTaster } = await searchParams

  const basePath = pullThroughBasePath(scope.mode)
  const dataset = await loadPullThroughDataset(scope)

  // Tastings come straight from the tasting records; the taster is the assigned user.
  // Attribution to the following order is computed by the shared loader.
  const attributed = attributedTastingsFromDataset(dataset)
  const ordersByAccountName = new Map(dataset.rows.map((row) => [row.accountId, row.accountName]))

  const performance = computeTasterPerformance(attributed, dataset.rows)
  const focused = selectedTaster ? performance.find((row) => row.tasterName === selectedTaster) ?? null : null

  const focusedTastings = focused
    ? Array.from(attributed.values())
        .flat()
        .filter((tasting) => (tasting.tasterName ?? 'Unassigned') === focused.tasterName)
        .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
    : []

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={basePath}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Taster Performance</h1>
          <p className="mt-1 text-muted-foreground">
            Built from tasting records, their reports and taster invoices. Ranked on sustained 60-day net contribution,
            not bottles poured — a tasting that seeds repeat orders beats one that only sells at the table. Reorder columns count tastings followed by an order — an
            association, not a proven cause.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Tasters</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {performance.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No tastings recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    {[
                      'Taster',
                      'Tastings',
                      'With Report',
                      'Accounts',
                      'Total Bottles',
                      'Avg Bottles',
                      'Order ≤7d',
                      'Order ≤14d',
                      'Order ≤30d',
                      'Avg Days to Order',
                      'Avg Pull-Through',
                      'Spend',
                      'Reorders Generated',
                      'Cost / Case',
                      'Cost / Reorder',
                      'Avg ROI',
                      '30d Net',
                      '60d Net',
                      '90d Net',
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
                  {performance.map((row) => (
                    <tr key={row.tasterName} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                      <td className="px-3 py-3">
                        <Link
                          href={`${basePath}/tasters?taster=${encodeURIComponent(row.tasterName)}`}
                          className="font-medium text-slate-900 hover:text-blue-600 hover:underline"
                        >
                          {row.tasterName}
                        </Link>
                      </td>
                      <td className="px-3 py-3 text-right font-semibold text-slate-900">{row.tastingsCompleted}</td>
                      <td className="px-3 py-3 text-right text-slate-700">{row.tastingsWithReport}</td>
                      <td className="px-3 py-3 text-right text-slate-700">{row.accountsWorked}</td>
                      <td className="px-3 py-3 text-right font-semibold text-slate-900">{row.totalBottlesSold}</td>
                      <td className="px-3 py-3 text-right text-slate-700">
                        {row.avgBottlesSold == null ? '—' : row.avgBottlesSold.toFixed(1)}
                      </td>
                      <td className="px-3 py-3 text-right text-slate-700">{row.reorderWithin7}</td>
                      <td className="px-3 py-3 text-right text-slate-700">{row.reorderWithin14}</td>
                      <td className="px-3 py-3 text-right text-slate-700">{row.reorderWithin30}</td>
                      <td className="px-3 py-3 text-right text-slate-700">
                        {row.avgDaysToReorder == null ? '—' : `${row.avgDaysToReorder.toFixed(0)}d`}
                      </td>
                      <td className="px-3 py-3 text-right text-slate-700">
                        {row.avgPullThroughScore == null ? (
                          <span className="text-[11px] text-slate-400">{NOT_ENOUGH_DATA}</span>
                        ) : (
                          row.avgPullThroughScore.toFixed(0)
                        )}
                      </td>
                      <td className="px-3 py-3 text-right text-slate-700">{fmtMoney(row.tastingSpend)}</td>
                      <td className="px-3 py-3 text-right font-semibold text-slate-900">{row.reordersGenerated}</td>
                      <td className="px-3 py-3 text-right text-slate-700">{row.costPerCaseMoved == null ? '—' : fmtMoney(row.costPerCaseMoved)}</td>
                      <td className="px-3 py-3 text-right text-slate-700">{row.costPerReorder == null ? '—' : fmtMoney(row.costPerReorder)}</td>
                      <td className={`px-3 py-3 text-right ${moneyTone(row.avgRoi)}`}>{row.avgRoi == null ? '—' : fmtPercent(row.avgRoi)}</td>
                      {([row.sustained.d30, row.sustained.d60, row.sustained.d90] as const).map((window, index) => (
                        <td key={index} className={`px-3 py-3 text-right ${moneyTone(window.net)}`}>
                          {window.net == null ? (
                            <span className="text-[11px] text-slate-400">Not matured</span>
                          ) : (
                            <>
                              {fmtMoney(window.net)}
                              <span className="block text-[10px] text-slate-400">{window.tastings} tasting{window.tastings === 1 ? '' : 's'}</span>
                            </>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {focused && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{focused.tasterName} — Events &amp; Accounts</CardTitle>
            <p className="text-xs text-muted-foreground">
              {focusedTastings.length} tasting{focusedTastings.length === 1 ? '' : 's'} across {focused.accountsWorked}{' '}
              account{focused.accountsWorked === 1 ? '' : 's'}
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    {['Date', 'Account', 'Event', 'Bottles Sold', 'Following Order', 'Days'].map((label, index) => (
                      <th
                        key={label}
                        className={`whitespace-nowrap px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground ${
                          index >= 3 ? 'text-right' : 'text-left'
                        }`}
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {focusedTastings.map((tasting) => (
                    <tr key={tasting.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                      <td className="whitespace-nowrap px-3 py-3">
                        <Link
                          href={tastingDetailPath(scope.mode, tasting.id)}
                          className="text-blue-600 hover:underline"
                        >
                          {fmtShortDate(tasting.occurredAt)}
                        </Link>
                      </td>
                      <td className="px-3 py-3">
                        <Link
                          href={`${basePath}${buildFilterQuery({ q: ordersByAccountName.get(tasting.accountId) ?? '' })}`}
                          className="text-slate-900 hover:text-blue-600 hover:underline"
                        >
                          {ordersByAccountName.get(tasting.accountId) ?? 'Unknown account'}
                        </Link>
                      </td>
                      <td className="px-3 py-3 text-slate-600">{tasting.eventName}</td>
                      <td className="px-3 py-3 text-right text-slate-700">
                        {tasting.bottlesSold ?? <span className="text-amber-600">Not recorded</span>}
                      </td>
                      <td className="px-3 py-3 text-right text-slate-700">
                        {tasting.nextOrderAt ? fmtShortDate(tasting.nextOrderAt) : '—'}
                      </td>
                      <td className="px-3 py-3 text-right font-semibold text-slate-900">
                        {tasting.daysToNextOrder == null ? '—' : `${tasting.daysToNextOrder}d`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
