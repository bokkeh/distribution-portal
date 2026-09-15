/**
 * Tasting performance roll-ups for the dashboard: totals, ROI at each horizon, and
 * breakdowns by taster, account, market, objective and distributor. Reads the
 * economics already attached to each tasting — nothing is recomputed or stored here.
 */

import { daysBetween } from './metrics'
import type { PullThroughAccountRow, PullThroughTasting, TastingObjective } from './types'

export type TastingDashboardFilters = {
  from: Date | null
  to: Date | null
  taster: string | null
  objective: TastingObjective | 'unset' | null
  market: string | null
  distributor: string | null
}

export type TastingDashboardTotals = {
  tastings: number
  tastingsThisMonth: number
  retailTastings: number
  strategicTastings: number
  spend: number
  strategicSpend: number
  bottlesSoldAtTastings: number
  casesMovedAtTastings: number
  reordersGenerated: number
  attributedCases: number
  costPerReorder: number | null
  costPerIncrementalCase: number | null
  avgImmediateRoi: number | null
  roi30: number | null
  roi60: number | null
  roi90: number | null
  net30: number
  net60: number
  net90: number
  organicCasesAfterTastings: number
  tastingDependentAccounts: number
  healthyOrganicAccounts: number
  unprofitableAccounts: number
  /** Tastings scheduled without an objective — shown so the gap gets closed. */
  withoutObjective: number
}

export type TastingBreakdownRow = {
  key: string
  label: string
  sublabel: string | null
  tastings: number
  spend: number
  bottlesSold: number
  attributedCases: number
  reorders: number
  costPerReorder: number | null
  costPerCase: number | null
  avgRoi: number | null
  net60: number
  organicCases90: number
  href: string | null
}

const round = (value: number, digits = 2) => Math.round(value * 10 ** digits) / 10 ** digits

function average(values: number[]) {
  if (values.length === 0) return null
  return round(values.reduce((sum, value) => sum + value, 0) / values.length, 0)
}

function windowNet(tasting: PullThroughTasting, days: 30 | 60 | 90) {
  return tasting.economics?.windows.find((window) => window.days === days)?.net ?? -tasting.cost
}

function windowOrganic(tasting: PullThroughTasting, days: 30 | 60 | 90) {
  return tasting.economics?.windows.find((window) => window.days === days)?.organicCases ?? 0
}

/** Retail tastings only (strategic ones distort sell-through economics). */
export function retailTastings(tastings: PullThroughTasting[]) {
  return tastings.filter((tasting) => (tasting.status === 'completed' || tasting.hasReport) && tasting.objective !== 'strategic')
}

export function filterTastings(
  tastings: PullThroughTasting[],
  rowsByAccount: Map<string, PullThroughAccountRow>,
  filters: TastingDashboardFilters,
) {
  return tastings.filter((tasting) => {
    if (filters.from && tasting.occurredAt < filters.from) return false
    if (filters.to && tasting.occurredAt > filters.to) return false
    if (filters.taster && (tasting.tasterName ?? 'Unassigned') !== filters.taster) return false
    if (filters.objective === 'unset' ? tasting.objective != null : filters.objective && tasting.objective !== filters.objective) return false
    const row = rowsByAccount.get(tasting.accountId)
    if (filters.market && row?.market !== filters.market) return false
    if (filters.distributor && row?.distributor !== filters.distributor) return false
    return true
  })
}

export function computeTastingDashboardTotals(
  tastings: PullThroughTasting[],
  rows: PullThroughAccountRow[],
  now: Date,
): TastingDashboardTotals {
  const held = tastings.filter((tasting) => tasting.status === 'completed' || tasting.hasReport)
  const retail = held.filter((tasting) => tasting.objective !== 'strategic')
  const strategic = held.filter((tasting) => tasting.objective === 'strategic')
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const spend = retail.reduce((sum, tasting) => sum + tasting.cost, 0)
  const bottlesSold = retail.reduce((sum, tasting) => sum + (tasting.bottlesSold ?? 0), 0)
  const attributedCases = retail.reduce((sum, tasting) => sum + (tasting.economics?.attributedCases ?? 0), 0)
  const reorders = retail.filter((tasting) => tasting.economics?.attributedOrderId != null).length
  const rois = retail.map((tasting) => tasting.economics?.roiPercent).filter((value): value is number => value != null)

  const sumNet = (days: 30 | 60 | 90) => retail.reduce((sum, tasting) => sum + windowNet(tasting, days), 0)
  const net30 = sumNet(30)
  const net60 = sumNet(60)
  const net90 = sumNet(90)
  const roiAt = (net: number) => (spend > 0 ? round((net / spend) * 100, 0) : null)

  const accountsWithTastings = new Set(retail.map((tasting) => tasting.accountId))
  const touched = rows.filter((row) => accountsWithTastings.has(row.accountId))

  return {
    tastings: held.length,
    tastingsThisMonth: held.filter((tasting) => tasting.occurredAt >= monthStart).length,
    retailTastings: retail.length,
    strategicTastings: strategic.length,
    spend: round(spend),
    strategicSpend: round(strategic.reduce((sum, tasting) => sum + tasting.cost, 0)),
    bottlesSoldAtTastings: bottlesSold,
    casesMovedAtTastings: round(bottlesSold / 12, 1),
    reordersGenerated: reorders,
    attributedCases: round(attributedCases, 1),
    costPerReorder: reorders > 0 ? round(spend / reorders, 0) : null,
    costPerIncrementalCase: attributedCases > 0 ? round(spend / attributedCases, 0) : null,
    avgImmediateRoi: average(rois),
    roi30: roiAt(net30),
    roi60: roiAt(net60),
    roi90: roiAt(net90),
    net30: round(net30),
    net60: round(net60),
    net90: round(net90),
    organicCasesAfterTastings: round(retail.reduce((sum, tasting) => sum + windowOrganic(tasting, 90), 0), 1),
    tastingDependentAccounts: touched.filter((row) => row.health.kind === 'tasting_dependent' || row.dependency.status === 'unprofitable_cycle').length,
    healthyOrganicAccounts: rows.filter((row) => row.health.kind === 'healthy' || row.health.kind === 'growth').length,
    unprofitableAccounts: rows.filter((row) => row.economics.retailTastingCount > 0 && row.economics.tastingSpend > row.economics.contribution).length,
    withoutObjective: held.filter((tasting) => tasting.objective == null).length,
  }
}

type GroupKey = 'taster' | 'account' | 'market' | 'objective' | 'distributor'

export function breakdownTastings(
  tastings: PullThroughTasting[],
  rowsByAccount: Map<string, PullThroughAccountRow>,
  groupBy: GroupKey,
  hrefFor?: (key: string, group: GroupKey) => string | null,
): TastingBreakdownRow[] {
  const retail = retailTastings(tastings)
  const buckets = new Map<string, { label: string; sublabel: string | null; tastings: PullThroughTasting[] }>()

  for (const tasting of retail) {
    const row = rowsByAccount.get(tasting.accountId)
    let key: string
    let label: string
    let sublabel: string | null = null

    switch (groupBy) {
      case 'taster':
        key = tasting.tasterUserId ?? 'unassigned'
        label = tasting.tasterName ?? 'Unassigned'
        break
      case 'account':
        key = tasting.accountId
        label = row?.accountName ?? tasting.eventName
        sublabel = row ? [row.city, row.market].filter(Boolean).join(' · ') || null : null
        break
      case 'market':
        key = row?.market ?? 'unknown'
        label = row?.market ?? 'Unknown market'
        break
      case 'objective':
        key = tasting.objective ?? 'unset'
        label = tasting.objective ?? 'No objective set'
        break
      case 'distributor':
        key = row?.distributor ?? 'unknown'
        label = row?.distributor ?? 'Unknown'
        break
    }

    const bucket = buckets.get(key) ?? { label, sublabel, tastings: [] }
    bucket.tastings.push(tasting)
    buckets.set(key, bucket)
  }

  return Array.from(buckets.entries())
    .map(([key, bucket]) => {
      const spend = bucket.tastings.reduce((sum, tasting) => sum + tasting.cost, 0)
      const attributedCases = bucket.tastings.reduce((sum, tasting) => sum + (tasting.economics?.attributedCases ?? 0), 0)
      const reorders = bucket.tastings.filter((tasting) => tasting.economics?.attributedOrderId != null).length
      const rois = bucket.tastings.map((tasting) => tasting.economics?.roiPercent).filter((value): value is number => value != null)
      return {
        key,
        label: bucket.label,
        sublabel: bucket.sublabel,
        tastings: bucket.tastings.length,
        spend: round(spend),
        bottlesSold: bucket.tastings.reduce((sum, tasting) => sum + (tasting.bottlesSold ?? 0), 0),
        attributedCases: round(attributedCases, 1),
        reorders,
        costPerReorder: reorders > 0 ? round(spend / reorders, 0) : null,
        costPerCase: attributedCases > 0 ? round(spend / attributedCases, 0) : null,
        avgRoi: average(rois),
        net60: round(bucket.tastings.reduce((sum, tasting) => sum + windowNet(tasting, 60), 0)),
        organicCases90: round(bucket.tastings.reduce((sum, tasting) => sum + windowOrganic(tasting, 90), 0), 1),
        href: hrefFor ? hrefFor(key, groupBy) : null,
      } satisfies TastingBreakdownRow
    })
    .sort((a, b) => b.net60 - a.net60)
}

/** Sustained results after a taster's tastings — the spec asks for these over bottles poured. */
export function tasterSustainedResults(tastings: PullThroughTasting[], now: Date) {
  const retail = retailTastings(tastings)
  const matured = (days: number) => retail.filter((tasting) => daysBetween(tasting.occurredAt, now) >= days)
  const summarise = (days: 30 | 60 | 90) => {
    const list = matured(days)
    if (list.length === 0) return { tastings: 0, net: null as number | null, organicCases: null as number | null }
    return {
      tastings: list.length,
      net: round(list.reduce((sum, tasting) => sum + windowNet(tasting, days), 0)),
      organicCases: round(list.reduce((sum, tasting) => sum + windowOrganic(tasting, days), 0), 1),
    }
  }
  return { d30: summarise(30), d60: summarise(60), d90: summarise(90) }
}
