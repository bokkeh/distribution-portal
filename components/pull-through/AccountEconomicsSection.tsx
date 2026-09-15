import Link from 'next/link'
import { AlertTriangle, ArrowRight, Scale, TrendingUp, Wine } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AccountTimeline } from '@/components/pull-through/AccountTimeline'
import { TastingDecisionPanel } from '@/components/pull-through/TastingDecisionPanel'
import { buildTastingDecision } from '@/lib/pull-through/economics'
import {
  ATTRIBUTION_META,
  DEPENDENCY_META,
  HEALTH_META,
  NOT_ENOUGH_DATA,
  OBJECTIVE_META,
  fmtMoney,
  fmtPercent,
  moneyTone,
} from '@/lib/pull-through/display'
import { formatDate } from '@/lib/utils'
import type { AccountIntelligence } from '@/lib/pull-through/data'
import type { ViewerMode } from '@/lib/pull-through/types'

function Stat({
  label,
  value,
  sub,
  tone = 'text-slate-900',
  emphasis = false,
}: {
  label: string
  value: string
  sub?: string | null
  tone?: string
  emphasis?: boolean
}) {
  return (
    <div className={`rounded-xl border p-3 ${emphasis ? 'border-slate-300 bg-white shadow-sm' : 'border-slate-200 bg-white'}`}>
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 font-bold leading-tight ${emphasis ? 'text-2xl' : 'text-lg'} ${tone}`}>{value}</p>
      {sub && <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{sub}</p>}
    </div>
  )
}

function SplitBar({ organicPercent }: { organicPercent: number | null }) {
  if (organicPercent == null) {
    return <div className="h-2.5 w-full rounded-full bg-slate-100" />
  }
  return (
    <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-violet-200">
      <div className="h-full bg-emerald-500" style={{ width: `${organicPercent}%` }} />
    </div>
  )
}

/**
 * Account Economics — answers "is this account creating recurring demand, or are we
 * paying for a tasting every time we want it to move another case?" Reads the same
 * computed row the pull-through dashboard uses; nothing here is stored.
 */
export function AccountEconomicsSection({
  intelligence,
  mode,
  basePath,
}: {
  intelligence: AccountIntelligence
  mode: ViewerMode
  basePath: string
}) {
  const { row, tastings, orders, timeline, settings } = intelligence
  const { velocity, dependency, economics, health } = row
  const healthMeta = HEALTH_META[health.kind]
  const depMeta = DEPENDENCY_META[dependency.status]
  const commercialOrders = orders.filter((order) => order.orderType === 'paid')
  const heldTastings = tastings.filter((tasting) => tasting.status === 'completed' || tasting.hasReport)

  const decision = buildTastingDecision({
    orders: row.orders,
    inventory: row.inventory,
    tastings,
    velocity,
    dependency,
    economics,
    health,
    settings,
    now: new Date(),
  })

  const tastingsDesc = [...heldTastings].reverse()
  const ordersDesc = [...commercialOrders].reverse()

  return (
    <div className="space-y-6">
      {/* Headline: health, dependency, organic velocity */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <Scale className="h-4 w-4 text-slate-500" />
              Account Economics
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-bold ${healthMeta.chip}`}>
                {healthMeta.label}
                {health.source === 'override' && <span className="font-normal opacity-70">· set manually</span>}
              </span>
              <span className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-semibold ${depMeta.chip}`}>
                {depMeta.label}
              </span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {healthMeta.description}. {health.why.join(' · ')}
            {health.source === 'override' && health.overrideReason ? ` — override reason: ${health.overrideReason}` : ''}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Organic velocity</p>
                  <p className="mt-1 text-4xl font-bold leading-none text-emerald-700">
                    {velocity.organicPercent == null ? '—' : `${velocity.organicPercent.toFixed(0)}%`}
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    {velocity.organicCases.toFixed(1)} of {velocity.totalCases.toFixed(1)} cases earned without a paid tasting
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Tasting dependency</p>
                  <p className="mt-1 text-2xl font-bold leading-none text-violet-700">
                    {dependency.percent == null ? '—' : `${dependency.percent.toFixed(0)}%`}
                  </p>
                  <p className="mt-1 text-xs text-slate-600">{velocity.assistedCases.toFixed(1)} tasting-assisted cases</p>
                </div>
              </div>
              <div className="mt-3">
                <SplitBar organicPercent={velocity.organicPercent} />
                <div className="mt-1 flex justify-between text-[10px] text-slate-500">
                  <span>Organic</span>
                  <span>Tasting-assisted</span>
                </div>
              </div>
              <p className="mt-3 text-sm font-medium text-slate-800">{dependency.headline}</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Contribution before vs after tastings</p>
              <dl className="mt-2 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-600">Contribution from cases</dt>
                  <dd className="font-semibold text-slate-900">{fmtMoney(economics.contribution)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-600">Tasting spend ({economics.retailTastingCount})</dt>
                  <dd className="font-semibold text-rose-700">{economics.tastingSpend > 0 ? `-${fmtMoney(economics.tastingSpend)}` : '$0'}</dd>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-1.5">
                  <dt className="font-semibold text-slate-800">Net account contribution</dt>
                  <dd className={`text-lg font-bold ${moneyTone(economics.netContribution)}`}>{fmtMoney(economics.netContribution)}</dd>
                </div>
              </dl>
              <p className="mt-2 text-[11px] text-muted-foreground">
                ${settings.contributionPerCase}/case contribution · tastings costed from invoice, estimate, or ${settings.defaultTastingCost} default
                {economics.strategicSpend > 0 ? ` · ${fmtMoney(economics.strategicSpend)} strategic spend excluded` : ''}
              </p>
            </div>
          </div>

          {dependency.flags.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-800">
                <AlertTriangle className="h-3.5 w-3.5" />
                Dependency signals
              </p>
              <ul className="mt-2 space-y-1">
                {dependency.flags.map((flag) => (
                  <li key={flag.key} className="text-sm text-amber-900">
                    <span className="font-semibold">{flag.label}.</span> <span className="text-amber-800">{flag.detail}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Should we schedule another tasting? */}
      <TastingDecisionPanel decision={decision} settings={settings} />

      {/* Velocity */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4 text-slate-500" />
            Account Velocity
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Organic = product moved with no Wisher tasting behind it. Assisted = orders that followed a paid tasting.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Organic bottles / week" value={velocity.organicBottlesPerWeek == null ? NOT_ENOUGH_DATA : velocity.organicBottlesPerWeek.toFixed(1)} tone="text-emerald-700" emphasis />
            <Stat label="Assisted bottles / week" value={velocity.assistedBottlesPerWeek == null ? NOT_ENOUGH_DATA : velocity.assistedBottlesPerWeek.toFixed(1)} tone="text-violet-700" emphasis />
            <Stat label="Total bottles / week" value={velocity.bottlesPerWeek == null ? NOT_ENOUGH_DATA : velocity.bottlesPerWeek.toFixed(1)} sub={velocity.casesPerMonth == null ? null : `${velocity.casesPerMonth.toFixed(2)} cases / month`} />
            <Stat label="Days to sell one case" value={velocity.daysToSellOneCase == null ? NOT_ENOUGH_DATA : `${velocity.daysToSellOneCase}d`} sub={row.orders.avgDaysBetweenOrders == null ? null : `Reorders every ${Math.round(row.orders.avgDaysBetweenOrders)} days`} />
            <Stat label="Lifetime orders" value={String(velocity.totalOrders)} sub={`${velocity.totalCases.toFixed(1)} cases · ${Math.round(velocity.totalBottles)} bottles`} />
            <Stat label="Organic cases" value={velocity.organicCases.toFixed(1)} sub={`${Math.round(velocity.organicBottles)} bottles`} tone="text-emerald-700" />
            <Stat label="Tasting-assisted cases" value={velocity.assistedCases.toFixed(1)} sub={`${Math.round(velocity.assistedBottles)} bottles`} tone="text-violet-700" />
            <Stat label="Sold at tastings" value={`${velocity.bottlesSoldAtTastings} btl`} sub={`${heldTastings.length} tasting${heldTastings.length === 1 ? '' : 's'} · ${fmtMoney(economics.tastingSpend + economics.strategicSpend)} spend`} />
            <Stat label="Current inventory" value={row.inventory.bottles == null ? 'Unknown' : `${Math.round(row.inventory.bottles)} btl`} sub={row.inventory.lastConfirmedAt ? `${row.inventory.confidence} · ${formatDate(row.inventory.lastConfirmedAt)}` : 'No inventory check'} />
            <Stat label="Last order" value={row.orders.lastOrderAt ? formatDate(row.orders.lastOrderAt) : '—'} sub={row.orders.lastOrderCases == null ? null : `${row.orders.lastOrderCases} case${row.orders.lastOrderCases === 1 ? '' : 's'}`} />
            <Stat label="Last reorder" value={row.orders.reorderCount > 0 && row.orders.lastOrderAt ? formatDate(row.orders.lastOrderAt) : 'Never'} sub={`${row.orders.reorderCount} reorder${row.orders.reorderCount === 1 ? '' : 's'}`} />
            <Stat label="Last tasting" value={row.tastings.lastTastingAt ? formatDate(row.tastings.lastTastingAt) : 'Never'} sub={row.tastings.lastTasterName} />
          </div>
        </CardContent>
      </Card>

      {/* Profitability */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Account Profitability</CardTitle>
          <p className="text-xs text-muted-foreground">Order volume can look productive while the account is expensive to support — both are shown.</p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Revenue" value={fmtMoney(economics.revenue)} sub={`${economics.casesPurchased.toFixed(1)} cases purchased`} />
            <Stat label="Contribution from cases" value={fmtMoney(economics.contribution)} sub={`at $${settings.contributionPerCase} per case`} />
            <Stat label="Tasting spend" value={economics.tastingSpend > 0 ? `-${fmtMoney(economics.tastingSpend)}` : '$0'} sub={`${economics.retailTastingCount} retail tasting${economics.retailTastingCount === 1 ? '' : 's'}`} tone={economics.tastingSpend > 0 ? 'text-rose-700' : 'text-slate-900'} />
            <Stat label="Net account contribution" value={fmtMoney(economics.netContribution)} tone={moneyTone(economics.netContribution)} emphasis />
            <Stat label="Profit per tasting" value={fmtMoney(economics.profitPerTasting)} sub="Net contribution ÷ retail tastings" tone={moneyTone(economics.profitPerTasting)} />
            <Stat label="Net per case" value={fmtMoney(economics.netPerCase)} sub="After tasting spend" tone={moneyTone(economics.netPerCase)} />
            <Stat label="Lifetime account value" value={fmtMoney(economics.lifetimeValue)} tone={moneyTone(economics.lifetimeValue)} />
            <Stat label="Annualized value" value={fmtMoney(economics.annualizedValue)} sub={economics.annualizedValue == null ? 'Needs 30+ days of history' : 'Net contribution projected to a year'} tone={moneyTone(economics.annualizedValue)} />
          </div>
          {economics.strategicSpend > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">
              {fmtMoney(economics.strategicSpend)} of strategic tasting spend is tracked separately and excluded from these retail figures.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Order attribution */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Orders — organic or tasting-assisted</CardTitle>
          <p className="text-xs text-muted-foreground">
            A reorder inside {settings.attributionWindowDays} days of a tasting, or up to 45 days when the tasting sold at least{' '}
            {Math.round(settings.assistedSalesShare * 100)}% of the previous order, is classified as tasting-assisted.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {ordersDesc.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-muted-foreground">No commercial orders yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-2 text-left">Order</th>
                    <th className="px-4 py-2 text-right">Cases</th>
                    <th className="px-4 py-2 text-left">Classification</th>
                    <th className="px-4 py-2 text-left">Previous tasting</th>
                    <th className="px-4 py-2 text-right">Days after</th>
                    <th className="px-4 py-2 text-right">Sold at tasting</th>
                    <th className="px-4 py-2 text-right">Moved on its own</th>
                    <th className="px-4 py-2 text-left">Why</th>
                  </tr>
                </thead>
                <tbody>
                  {ordersDesc.map((order) => {
                    const attribution = order.attribution
                    const meta = attribution ? ATTRIBUTION_META[attribution.kind] : null
                    const href = mode === 'sales' ? null : `/${mode}/orders/${order.id}`
                    return (
                      <tr key={order.id} className="border-b border-slate-50 last:border-0">
                        <td className="whitespace-nowrap px-4 py-2.5">
                          {href ? (
                            <Link href={href} className="font-medium text-blue-600 hover:underline">{formatDate(order.orderedAt)}</Link>
                          ) : (
                            <span className="font-medium text-slate-900">{formatDate(order.orderedAt)}</span>
                          )}
                          <span className="block text-[11px] text-slate-500">{order.isReorder ? `Reorder #${order.sequenceIndex}` : 'Initial order'}</span>
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold text-slate-900">{order.cases.toFixed(1)}</td>
                        <td className="px-4 py-2.5">
                          {meta ? (
                            <span className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-semibold ${meta.chip}`}>
                              {meta.label}
                              {attribution?.source === 'override' && <span className="ml-1 font-normal opacity-70">(manual)</span>}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-slate-700">{attribution?.tastingAt ? formatDate(attribution.tastingAt) : '—'}</td>
                        <td className="px-4 py-2.5 text-right text-slate-700">{attribution?.daysSinceTasting ?? '—'}</td>
                        <td className="px-4 py-2.5 text-right text-slate-700">{attribution?.bottlesSoldAtTasting == null ? '—' : `${attribution.bottlesSoldAtTasting} btl`}</td>
                        <td className="px-4 py-2.5 text-right text-slate-700">{attribution?.bottlesMovedOutsideTasting == null ? '—' : `${Math.round(attribution.bottlesMovedOutsideTasting)} btl`}</td>
                        <td className="max-w-[320px] px-4 py-2.5 text-[12px] leading-snug text-slate-600">{attribution?.why ?? '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tasting economics */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Wine className="h-4 w-4 text-violet-500" />
            Tasting Economics
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Immediate = the reorder attributed to that tasting only. 30/60/90-day columns add every order that followed, organic included.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {tastingsDesc.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-muted-foreground">No tastings held at this account.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-2 text-left">Tasting</th>
                    <th className="px-4 py-2 text-left">Objective</th>
                    <th className="px-4 py-2 text-right">Cost</th>
                    <th className="px-4 py-2 text-right">Sold</th>
                    <th className="px-4 py-2 text-right">Attributed cases</th>
                    <th className="px-4 py-2 text-right">Immediate net</th>
                    <th className="px-4 py-2 text-right">ROI</th>
                    <th className="px-4 py-2 text-right">30-day net</th>
                    <th className="px-4 py-2 text-right">60-day net</th>
                    <th className="px-4 py-2 text-right">90-day net</th>
                  </tr>
                </thead>
                <tbody>
                  {tastingsDesc.map((tasting) => {
                    const econ = tasting.economics
                    const window = (days: number) => econ?.windows.find((w) => w.days === days) ?? null
                    const objective = tasting.objective ? OBJECTIVE_META[tasting.objective] : null
                    return (
                      <tr key={tasting.id} className="border-b border-slate-50 last:border-0">
                        <td className="whitespace-nowrap px-4 py-2.5">
                          <span className="font-medium text-slate-900">{formatDate(tasting.occurredAt)}</span>
                          <span className="block text-[11px] text-slate-500">{tasting.tasterName ?? 'Unassigned'}</span>
                        </td>
                        <td className="px-4 py-2.5 text-slate-700">
                          {objective ? objective.short : <span className="text-slate-400">Not set</span>}
                          {tasting.primaryGoal && <span className="block max-w-[200px] truncate text-[11px] text-slate-500">{tasting.primaryGoal}</span>}
                        </td>
                        <td className="px-4 py-2.5 text-right text-slate-900">
                          {fmtMoney(tasting.cost)}
                          <span className="block text-[10px] text-slate-400">{tasting.costSource}</span>
                        </td>
                        <td className="px-4 py-2.5 text-right text-slate-700">{tasting.bottlesSold == null ? '—' : `${tasting.bottlesSold} btl`}</td>
                        <td className="px-4 py-2.5 text-right text-slate-700">{econ ? econ.attributedCases.toFixed(1) : '—'}</td>
                        <td className={`px-4 py-2.5 text-right font-semibold ${moneyTone(econ?.net)}`}>{fmtMoney(econ?.net)}</td>
                        <td className={`px-4 py-2.5 text-right ${moneyTone(econ?.roiPercent)}`}>{econ?.roiPercent == null ? '—' : fmtPercent(econ.roiPercent)}</td>
                        {[30, 60, 90].map((days) => {
                          const w = window(days)
                          return (
                            <td key={days} className={`px-4 py-2.5 text-right ${moneyTone(w?.net)}`}>
                              {w ? fmtMoney(w.net) : '—'}
                              {w && w.organicCases > 0 && <span className="block text-[10px] text-emerald-600">+{w.organicCases.toFixed(1)} organic</span>}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          {tastingsDesc.some((tasting) => tasting.economics?.excludedFromRetailRollup) && (
            <p className="px-5 py-3 text-xs text-muted-foreground">Strategic tastings are listed for reference but excluded from retail ROI roll-ups.</p>
          )}
        </CardContent>
      </Card>

      {/* Timeline with dependency warning */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">Tasting History Timeline</CardTitle>
            <Link href={`${basePath}?tab=sales-intelligence`} className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline">
              Full Sales Intelligence
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <p className="text-xs text-muted-foreground">Order → Tasting → Reorder, in order, from the records themselves.</p>
        </CardHeader>
        <CardContent>
          {dependency.patternWarning && (
            <div className="mb-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
              <div>
                <p className="text-sm font-semibold text-rose-800">Potential tasting dependency</p>
                <p className="text-sm text-rose-800">{dependency.patternWarning}</p>
              </div>
            </div>
          )}
          <AccountTimeline events={timeline.filter((event) => event.kind === 'order' || event.kind === 'reorder' || event.kind === 'tasting' || event.kind === 'sample_order')} limit={40} />
        </CardContent>
      </Card>
    </div>
  )
}
