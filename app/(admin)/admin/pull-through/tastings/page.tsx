import { requireFeature } from '@/lib/auth/session'
import { TastingDashboard } from '@/components/pull-through/TastingDashboard'
import { loadPullThroughDataset, pullThroughBasePath, resolvePullThroughScope } from '@/lib/pull-through/data'
import {
  breakdownTastings,
  computeTastingDashboardTotals,
  filterTastings,
  type TastingDashboardFilters,
} from '@/lib/pull-through/tasting-dashboard'
import type { TastingObjective } from '@/lib/pull-through/types'

const OBJECTIVES: TastingObjective[] = ['sell_through', 'reorder', 'account_opening', 'strategic']

function str(value: string | string[] | undefined) {
  const single = Array.isArray(value) ? value[0] : value
  const trimmed = single?.trim()
  return trimmed ? trimmed : null
}

function parseDate(value: string | null, endOfDay = false) {
  if (!value) return null
  const parsed = new Date(endOfDay ? `${value}T23:59:59.999` : `${value}T00:00:00`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

/**
 * Tasting performance dashboard: the economics of tasting spend across the book, with
 * breakdowns by taster, account, market, objective and distributor.
 */
export default async function TastingPerformancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const session = await requireFeature('tastings', 'admin', 'sales_manager')
  const scope = await resolvePullThroughScope(session)
  const params = await searchParams
  const basePath = pullThroughBasePath(scope.mode)

  const dataset = await loadPullThroughDataset(scope)
  const rowsByAccount = new Map(dataset.rows.map((row) => [row.accountId, row]))
  const allTastings = Array.from(dataset.tastingsByAccount.values()).flat()

  const objectiveParam = str(params.objective)
  const filters: TastingDashboardFilters = {
    from: parseDate(str(params.from)),
    to: parseDate(str(params.to), true),
    taster: str(params.taster),
    objective:
      objectiveParam === 'unset' ? 'unset' : OBJECTIVES.includes(objectiveParam as TastingObjective) ? (objectiveParam as TastingObjective) : null,
    market: str(params.market),
    distributor: str(params.distributor),
  }

  const tastings = filterTastings(allTastings, rowsByAccount, filters)
  const now = new Date()
  const totals = computeTastingDashboardTotals(tastings, dataset.rows, now)

  const hrefFor = (key: string, group: string) => {
    if (group === 'account') return `${rowsByAccount.get(key)?.accountHref ?? ''}?tab=economics`
    if (group === 'taster') return `${basePath}/tasters?taster=${encodeURIComponent(key)}`
    return null
  }

  const uniq = (values: (string | null)[]) =>
    Array.from(new Set(values.filter((value): value is string => !!value))).sort((a, b) => a.localeCompare(b))

  return (
    <TastingDashboard
      basePath={basePath}
      totals={totals}
      settings={dataset.settings}
      breakdowns={{
        taster: breakdownTastings(tastings, rowsByAccount, 'taster', (key, group) =>
          group === 'taster' ? `${basePath}/tasters?taster=${encodeURIComponent(allTastings.find((t) => (t.tasterUserId ?? 'unassigned') === key)?.tasterName ?? 'Unassigned')}` : hrefFor(key, group),
        ),
        account: breakdownTastings(tastings, rowsByAccount, 'account', hrefFor),
        market: breakdownTastings(tastings, rowsByAccount, 'market'),
        objective: breakdownTastings(tastings, rowsByAccount, 'objective'),
        distributor: breakdownTastings(tastings, rowsByAccount, 'distributor'),
      }}
      filterOptions={{
        tasters: uniq(allTastings.map((tasting) => tasting.tasterName ?? 'Unassigned')),
        markets: uniq(dataset.rows.map((row) => row.market)),
        distributors: uniq(dataset.rows.map((row) => row.distributor)),
      }}
    />
  )
}
