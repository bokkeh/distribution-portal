import Link from 'next/link'
import { Suspense } from 'react'
import { ArrowLeft, DollarSign, RefreshCw, Scale, Wine } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DateRangeFilter } from '@/components/ui/date-range-filter'
import { TastingDashboardFilterBar } from '@/components/pull-through/TastingDashboardFilterBar'
import { NOT_ENOUGH_DATA, OBJECTIVE_META, fmtMoney, fmtPercent, moneyTone } from '@/lib/pull-through/display'
import type { TastingBreakdownRow, TastingDashboardTotals } from '@/lib/pull-through/tasting-dashboard'
import type { TastingEconomicsSettings, TastingObjective } from '@/lib/pull-through/types'

function Kpi({
  label,
  value,
  hint,
  tone = 'text-slate-900',
  icon: Icon,
}: {
  label: string
  value: string
  hint?: string | null
  tone?: string
  icon?: typeof Wine
}) {
  return (
    <Card className="h-full">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          {Icon && <Icon className="h-4 w-4 shrink-0 text-slate-300" />}
        </div>
        <p className={`mt-1.5 text-2xl font-bold ${tone}`}>{value}</p>
        {hint && <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  )
}

function BreakdownTable({ title, rows, labelHeader }: { title: string; rows: TastingBreakdownRow[]; labelHeader: string }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-muted-foreground">No retail tastings in this range.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2 text-left">{labelHeader}</th>
                  <th className="px-4 py-2 text-right">Tastings</th>
                  <th className="px-4 py-2 text-right">Spend</th>
                  <th className="px-4 py-2 text-right">Bottles sold</th>
                  <th className="px-4 py-2 text-right">Reorders</th>
                  <th className="px-4 py-2 text-right">Attributed cases</th>
                  <th className="px-4 py-2 text-right">Cost / reorder</th>
                  <th className="px-4 py-2 text-right">Cost / case</th>
                  <th className="px-4 py-2 text-right">Avg ROI</th>
                  <th className="px-4 py-2 text-right">60-day net</th>
                  <th className="px-4 py-2 text-right">Organic cases after</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.key} className="border-b border-slate-50 last:border-0">
                    <td className="px-4 py-2.5">
                      {row.href ? (
                        <Link href={row.href} className="font-medium text-slate-900 hover:text-blue-600 hover:underline">
                          {row.label}
                        </Link>
                      ) : (
                        <span className="font-medium text-slate-900">{row.label}</span>
                      )}
                      {row.sublabel && <span className="block text-[11px] text-slate-500">{row.sublabel}</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-700">{row.tastings}</td>
                    <td className="px-4 py-2.5 text-right text-slate-700">{fmtMoney(row.spend)}</td>
                    <td className="px-4 py-2.5 text-right text-slate-700">{row.bottlesSold}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-slate-900">{row.reorders}</td>
                    <td className="px-4 py-2.5 text-right text-slate-700">{row.attributedCases.toFixed(1)}</td>
                    <td className="px-4 py-2.5 text-right text-slate-700">{row.costPerReorder == null ? '—' : fmtMoney(row.costPerReorder)}</td>
                    <td className="px-4 py-2.5 text-right text-slate-700">{row.costPerCase == null ? '—' : fmtMoney(row.costPerCase)}</td>
                    <td className={`px-4 py-2.5 text-right ${moneyTone(row.avgRoi)}`}>{row.avgRoi == null ? '—' : fmtPercent(row.avgRoi)}</td>
                    <td className={`px-4 py-2.5 text-right font-semibold ${moneyTone(row.net60)}`}>{fmtMoney(row.net60)}</td>
                    <td className="px-4 py-2.5 text-right text-emerald-700">{row.organicCases90.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function TastingDashboard({
  basePath,
  totals,
  settings,
  breakdowns,
  filterOptions,
}: {
  basePath: string
  totals: TastingDashboardTotals
  settings: TastingEconomicsSettings
  breakdowns: {
    taster: TastingBreakdownRow[]
    account: TastingBreakdownRow[]
    market: TastingBreakdownRow[]
    objective: TastingBreakdownRow[]
    distributor: TastingBreakdownRow[]
  }
  filterOptions: { tasters: string[]; markets: string[]; distributors: string[] }
}) {
  const objectiveRows = breakdowns.objective.map((row) => ({
    ...row,
    label: row.key in OBJECTIVE_META ? OBJECTIVE_META[row.key as TastingObjective].label : row.label,
  }))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href={basePath}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Tasting Performance</h1>
            <p className="mt-1 text-muted-foreground">
              Does tasting spend create recurring demand, or just move the next case? Retail tastings only — strategic
              tastings are tracked separately. ${settings.contributionPerCase} contribution per case; cost from invoice, estimate
              or ${settings.defaultTastingCost} default.
            </p>
          </div>
        </div>
        <Suspense>
          <DateRangeFilter />
        </Suspense>
      </div>

      <TastingDashboardFilterBar options={filterOptions} basePath={`${basePath}/tastings`} />

      {/* Headline economics */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Tastings" value={String(totals.retailTastings)} hint={`${totals.tastingsThisMonth} this month · ${totals.strategicTastings} strategic excluded`} icon={Wine} />
        <Kpi label="Tasting spend" value={fmtMoney(totals.spend)} hint={totals.strategicSpend > 0 ? `+ ${fmtMoney(totals.strategicSpend)} strategic` : 'Retail tastings in range'} icon={DollarSign} tone="text-rose-700" />
        <Kpi label="Reorders generated" value={String(totals.reordersGenerated)} hint={totals.costPerReorder == null ? 'No attributed reorders yet' : `${fmtMoney(totals.costPerReorder)} per reorder`} icon={RefreshCw} />
        <Kpi label="Cost per incremental case" value={totals.costPerIncrementalCase == null ? NOT_ENOUGH_DATA : fmtMoney(totals.costPerIncrementalCase)} hint={`${totals.attributedCases.toFixed(1)} cases attributed · $${settings.contributionPerCase} contribution each`} icon={Scale} tone={totals.costPerIncrementalCase != null && totals.costPerIncrementalCase > settings.contributionPerCase ? 'text-rose-700' : 'text-slate-900'} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Avg immediate ROI" value={totals.avgImmediateRoi == null ? NOT_ENOUGH_DATA : fmtPercent(totals.avgImmediateRoi)} hint="Attributed reorder only" tone={moneyTone(totals.avgImmediateRoi)} />
        <Kpi label="30-day ROI" value={totals.roi30 == null ? NOT_ENOUGH_DATA : fmtPercent(totals.roi30)} hint={`${fmtMoney(totals.net30)} net`} tone={moneyTone(totals.roi30)} />
        <Kpi label="60-day ROI" value={totals.roi60 == null ? NOT_ENOUGH_DATA : fmtPercent(totals.roi60)} hint={`${fmtMoney(totals.net60)} net`} tone={moneyTone(totals.roi60)} />
        <Kpi label="90-day ROI" value={totals.roi90 == null ? NOT_ENOUGH_DATA : fmtPercent(totals.roi90)} hint={`${fmtMoney(totals.net90)} net · ${totals.organicCasesAfterTastings.toFixed(1)} organic cases followed`} tone={moneyTone(totals.roi90)} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Cases moved at tastings" value={totals.casesMovedAtTastings.toFixed(1)} hint={`${totals.bottlesSoldAtTastings} bottles sold during events`} />
        <Kpi label="Healthy organic accounts" value={String(totals.healthyOrganicAccounts)} hint="Growth or Healthy classification" tone="text-emerald-700" />
        <Kpi label="Tasting-dependent accounts" value={String(totals.tastingDependentAccounts)} hint="Among accounts with tastings in range" tone="text-amber-700" />
        <Kpi label="Spend exceeds contribution" value={String(totals.unprofitableAccounts)} hint="Accounts costing more in tastings than they return" tone={totals.unprofitableAccounts > 0 ? 'text-rose-700' : 'text-slate-900'} />
      </div>

      {totals.withoutObjective > 0 && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span className="font-semibold">{totals.withoutObjective} tasting{totals.withoutObjective === 1 ? '' : 's'}</span> in this range
          {totals.withoutObjective === 1 ? ' has' : ' have'} no objective set. Objective breakdowns only cover tastings scheduled with one.
        </p>
      )}

      <BreakdownTable title="By taster" labelHeader="Taster" rows={breakdowns.taster} />
      <BreakdownTable title="By account" labelHeader="Account" rows={breakdowns.account} />
      <BreakdownTable title="By objective" labelHeader="Objective" rows={objectiveRows} />
      <BreakdownTable title="By market" labelHeader="Market" rows={breakdowns.market} />
      <BreakdownTable title="By distributor" labelHeader="Distributor" rows={breakdowns.distributor} />
    </div>
  )
}
