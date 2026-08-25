/**
 * Dashboard filtering and roll-up KPIs.
 *
 * Filters use metadata that already lives on the account/CRM records — city, market,
 * territory, rep, account type — plus the derived signals. Every KPI is clickable and
 * maps onto exactly one filter value here, so a headline number and the table below it
 * can never disagree.
 */

import { INVENTORY_STALE_DAYS } from './metrics'
import type { AccountTemperature, PullThroughAccountRow } from './types'

export type PullThroughFilters = {
  q: string | null
  city: string | null
  market: string | null
  territory: string | null
  distributor: string | null
  rep: string | null
  taster: string | null
  accountType: string | null
  temperature: AccountTemperature | null
  inventoryStatus: 'confirmed' | 'estimated' | 'unknown' | 'stale' | 'low' | null
  reordered: 'yes' | 'no' | null
  tasted: 'yes' | 'no' | null
  action: string | null
  /** Only accounts whose last order is at least this many days old. */
  minDaysSinceOrder: number | null
  tastingPerformance: 'converted' | 'not_converted' | null
}

export const EMPTY_FILTERS: PullThroughFilters = {
  q: null,
  city: null,
  market: null,
  territory: null,
  distributor: null,
  rep: null,
  taster: null,
  accountType: null,
  temperature: null,
  inventoryStatus: null,
  reordered: null,
  tasted: null,
  action: null,
  minDaysSinceOrder: null,
  tastingPerformance: null,
}

function str(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export function parseFilters(params: Record<string, string | string[] | undefined>): PullThroughFilters {
  const minDays = str(params.minDays)
  const parsedMinDays = minDays != null ? Number(minDays) : null

  return {
    q: str(params.q),
    city: str(params.city),
    market: str(params.market),
    territory: str(params.territory),
    distributor: str(params.distributor),
    rep: str(params.rep),
    taster: str(params.taster),
    accountType: str(params.accountType),
    temperature: (str(params.temperature) as AccountTemperature | null) ?? null,
    inventoryStatus: (str(params.inventory) as PullThroughFilters['inventoryStatus']) ?? null,
    reordered: (str(params.reordered) as 'yes' | 'no' | null) ?? null,
    tasted: (str(params.tasted) as 'yes' | 'no' | null) ?? null,
    action: str(params.action),
    minDaysSinceOrder: parsedMinDays != null && Number.isFinite(parsedMinDays) ? parsedMinDays : null,
    tastingPerformance: (str(params.tastingPerformance) as 'converted' | 'not_converted' | null) ?? null,
  }
}

export function hasActiveFilters(filters: PullThroughFilters) {
  return Object.values(filters).some((value) => value != null)
}

export function buildFilterQuery(filters: Partial<PullThroughFilters>) {
  const params = new URLSearchParams()
  const map: Record<string, unknown> = {
    q: filters.q,
    city: filters.city,
    market: filters.market,
    territory: filters.territory,
    distributor: filters.distributor,
    rep: filters.rep,
    taster: filters.taster,
    accountType: filters.accountType,
    temperature: filters.temperature,
    inventory: filters.inventoryStatus,
    reordered: filters.reordered,
    tasted: filters.tasted,
    action: filters.action,
    minDays: filters.minDaysSinceOrder,
    tastingPerformance: filters.tastingPerformance,
  }

  for (const [key, value] of Object.entries(map)) {
    if (value != null && value !== '') params.set(key, String(value))
  }

  const query = params.toString()
  return query ? `?${query}` : ''
}

export function applyFilters(
  rows: PullThroughAccountRow[],
  filters: PullThroughFilters,
  tasterNamesByAccount?: Map<string, string[]>,
): PullThroughAccountRow[] {
  return rows.filter((row) => {
    if (filters.q) {
      const needle = filters.q.toLowerCase()
      const haystack = [row.accountName, row.city, row.state, row.primaryContactName, row.salesRepName]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(needle)) return false
    }

    if (filters.city && row.city !== filters.city) return false
    if (filters.market && row.market !== filters.market) return false
    if (filters.territory && row.territory !== filters.territory) return false
    if (filters.distributor && row.distributor !== filters.distributor) return false
    if (filters.accountType && row.accountType !== filters.accountType) return false

    if (filters.rep) {
      if (filters.rep === 'unassigned' ? row.salesRepId != null : row.salesRepId !== filters.rep) return false
    }

    if (filters.taster) {
      const names = tasterNamesByAccount?.get(row.accountId) ?? []
      if (!names.includes(filters.taster)) return false
    }

    if (filters.temperature && row.temperature !== filters.temperature) return false

    if (filters.inventoryStatus) {
      const { confidence, daysSinceConfirmed, estimatedDaysOfInventory, bottles } = row.inventory
      if (filters.inventoryStatus === 'stale') {
        if (!(daysSinceConfirmed != null && daysSinceConfirmed > INVENTORY_STALE_DAYS)) return false
      } else if (filters.inventoryStatus === 'low') {
        const isLow =
          (estimatedDaysOfInventory != null && estimatedDaysOfInventory <= 10) || (bottles != null && bottles <= 6)
        if (!isLow) return false
      } else if (confidence !== filters.inventoryStatus) {
        return false
      }
    }

    if (filters.reordered === 'yes' && row.orders.reorderCount === 0) return false
    if (filters.reordered === 'no' && row.orders.reorderCount > 0) return false

    if (filters.tasted === 'yes' && !row.tastings.hasEverHadTasting) return false
    if (filters.tasted === 'no' && row.tastings.hasEverHadTasting) return false

    if (filters.action && row.recommendation.key !== filters.action) return false

    if (filters.minDaysSinceOrder != null) {
      if (row.orders.daysSinceLastOrder == null || row.orders.daysSinceLastOrder < filters.minDaysSinceOrder) {
        return false
      }
    }

    if (filters.tastingPerformance === 'converted' && row.tastings.followedBy30 === 0) return false
    if (filters.tastingPerformance === 'not_converted') {
      if (!row.tastings.hasEverHadTasting || row.tastings.followedBy30 > 0) return false
    }

    return true
  })
}

/* --------------------------------------------------------------------- KPIs */

export type PullThroughKpi = {
  key: string
  label: string
  value: string
  hint: string
  /** Filter query that reproduces exactly this subset in the table below. */
  href: string | null
  tone: 'neutral' | 'good' | 'warn' | 'bad'
}

function pct(numerator: number, denominator: number) {
  if (denominator === 0) return null
  return (numerator / denominator) * 100
}

function fmtPct(value: number | null) {
  return value == null ? 'Not enough data' : `${value.toFixed(0)}%`
}

function fmtNum(value: number | null, digits = 1) {
  return value == null ? 'Not enough data' : value.toFixed(digits)
}

export function computeKpis(rows: PullThroughAccountRow[], basePath: string): PullThroughKpi[] {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const link = (filters: Partial<PullThroughFilters>) => `${basePath}${buildFilterQuery(filters)}`

  const active = rows.filter((row) => row.orders.totalOrders > 0)
  const hot = rows.filter((row) => row.temperature === 'hot')
  const atRisk = rows.filter((row) => row.temperature === 'at_risk')

  const readyForReorder = rows.filter(
    (row) =>
      row.recommendation.key === 'call_for_reorder' ||
      row.recommendation.key === 'high_priority' ||
      row.recommendation.key === 'first_reorder_push',
  )

  const needInventoryCheck = rows.filter(
    (row) =>
      row.inventory.confidence === 'unknown' ||
      (row.inventory.daysSinceConfirmed != null && row.inventory.daysSinceConfirmed > INVENTORY_STALE_DAYS),
  )

  const withOrders = rows.filter((row) => row.orders.totalOrders > 0)
  const reordered = rows.filter((row) => row.orders.reorderCount > 0)
  const neverReordered = withOrders.filter((row) => row.orders.reorderCount === 0)

  const cadences = rows
    .map((row) => row.orders.avgDaysBetweenOrders)
    .filter((value): value is number => value != null)
  const avgCadence = cadences.length > 0 ? cadences.reduce((a, b) => a + b, 0) / cadences.length : null

  const tastingSales = rows
    .map((row) => row.tastings.avgBottlesSoldPerTasting)
    .filter((value): value is number => value != null)
  const avgTastingSales =
    tastingSales.length > 0 ? tastingSales.reduce((a, b) => a + b, 0) / tastingSales.length : null

  const tastingsThisMonth = rows.filter(
    (row) => row.tastings.lastTastingAt != null && row.tastings.lastTastingAt >= monthStart,
  ).length

  // Conversion is measured per tasting, not per account.
  const totals = rows.reduce(
    (acc, row) => {
      acc.tastings += row.tastings.tastingCount
      acc.within7 += row.tastings.followedBy7
      acc.within14 += row.tastings.followedBy14
      acc.within30 += row.tastings.followedBy30
      return acc
    },
    { tastings: 0, within7: 0, within14: 0, within30: 0 },
  )

  const stockNoActivity = rows.filter(
    (row) =>
      row.inventory.bottles != null &&
      row.inventory.bottles > 0 &&
      row.orders.daysSinceLastOrder != null &&
      row.orders.daysSinceLastOrder > 45,
  )

  return [
    {
      key: 'active',
      label: 'Active Accounts',
      value: String(active.length),
      hint: `${rows.length} accounts in view, ${active.length} with order history`,
      href: link({ minDaysSinceOrder: 0 }),
      tone: 'neutral',
    },
    {
      key: 'hot',
      label: 'Hot Accounts',
      value: String(hot.length),
      hint: 'Reordering inside their normal window',
      href: link({ temperature: 'hot' }),
      tone: 'good',
    },
    {
      key: 'at_risk',
      label: 'At-Risk Accounts',
      value: String(atRisk.length),
      hint: 'Established pattern broken',
      href: link({ temperature: 'at_risk' }),
      tone: 'bad',
    },
    {
      key: 'ready',
      label: 'Ready for Reorder',
      value: String(readyForReorder.length),
      hint: 'Low stock or past their cadence',
      href: link({ action: 'call_for_reorder' }),
      tone: 'warn',
    },
    {
      key: 'inventory_checks',
      label: 'Need Inventory Checks',
      value: String(needInventoryCheck.length),
      hint: `Never checked, or older than ${INVENTORY_STALE_DAYS} days`,
      href: link({ inventoryStatus: 'stale' }),
      tone: 'warn',
    },
    {
      key: 'reorder_rate',
      label: 'Reorder Rate',
      value: fmtPct(pct(reordered.length, withOrders.length)),
      hint: `${reordered.length} of ${withOrders.length} accounts with orders have reordered`,
      href: link({ reordered: 'yes' }),
      tone: 'neutral',
    },
    {
      key: 'avg_cadence',
      label: 'Avg Days Between Orders',
      value: avgCadence == null ? 'Not enough data' : avgCadence.toFixed(0),
      hint: `Across ${cadences.length} accounts with two or more orders`,
      href: null,
      tone: 'neutral',
    },
    {
      key: 'avg_tasting_sales',
      label: 'Avg Tasting Sales',
      value: avgTastingSales == null ? 'Not enough data' : `${fmtNum(avgTastingSales)} btl`,
      hint: 'Bottles sold per tasting, from tasting reports',
      href: link({ tasted: 'yes' }),
      tone: 'neutral',
    },
    {
      key: 'tastings_month',
      label: 'Tastings This Month',
      value: String(tastingsThisMonth),
      hint: 'Accounts with a tasting since the 1st',
      href: link({ tasted: 'yes' }),
      tone: 'neutral',
    },
    {
      key: 'conv7',
      label: 'Tasting to 7-Day Order',
      value: fmtPct(pct(totals.within7, totals.tastings)),
      hint: `${totals.within7} of ${totals.tastings} tastings followed by an order within 7 days`,
      href: link({ tastingPerformance: 'converted' }),
      tone: 'neutral',
    },
    {
      key: 'conv14',
      label: 'Tasting to 14-Day Order',
      value: fmtPct(pct(totals.within14, totals.tastings)),
      hint: `${totals.within14} of ${totals.tastings} tastings followed by an order within 14 days`,
      href: link({ tastingPerformance: 'converted' }),
      tone: 'neutral',
    },
    {
      key: 'conv30',
      label: 'Tasting to 30-Day Order',
      value: fmtPct(pct(totals.within30, totals.tastings)),
      hint: `${totals.within30} of ${totals.tastings} tastings followed by an order within 30 days`,
      href: link({ tastingPerformance: 'converted' }),
      tone: 'neutral',
    },
    {
      key: 'never_reordered',
      label: 'Never Reordered',
      value: String(neverReordered.length),
      hint: 'Ordered once and never came back',
      href: link({ reordered: 'no' }),
      tone: 'warn',
    },
    {
      key: 'stock_no_activity',
      label: 'Stock, No Recent Activity',
      value: String(stockNoActivity.length),
      hint: 'Inventory on hand but no order in 45+ days',
      href: link({ minDaysSinceOrder: 45 }),
      tone: 'warn',
    },
  ]
}

/** Distinct filter options, taken from the accounts actually in scope. */
export function collectFilterOptions(rows: PullThroughAccountRow[]) {
  const uniq = (values: (string | null)[]) =>
    Array.from(new Set(values.filter((value): value is string => !!value))).sort((a, b) => a.localeCompare(b))

  return {
    cities: uniq(rows.map((row) => row.city)),
    markets: uniq(rows.map((row) => row.market)),
    territories: uniq(rows.map((row) => row.territory)),
    distributors: uniq(rows.map((row) => row.distributor)),
    accountTypes: uniq(rows.map((row) => row.accountType)),
    reps: Array.from(
      new Map(
        rows
          .filter((row) => row.salesRepId && row.salesRepName)
          .map((row) => [row.salesRepId as string, row.salesRepName as string]),
      ).entries(),
    ).sort((a, b) => a[1].localeCompare(b[1])),
  }
}
