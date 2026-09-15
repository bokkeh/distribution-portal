/**
 * Taster and sales-rep performance rollups.
 *
 * Both are derived from the portal's existing people records — tasters are the users
 * assigned to tastings, reps are the sales_members already owning accounts. This file
 * creates no separate staff directory.
 */

import { INVENTORY_STALE_DAYS } from './metrics'
import { retailTastings, tasterSustainedResults } from './tasting-dashboard'
import type { PullThroughAccountRow, PullThroughTasting } from './types'

export type TasterPerformanceRow = {
  tasterUserId: string | null
  tasterName: string
  tastingsCompleted: number
  tastingsWithReport: number
  totalBottlesSold: number
  avgBottlesSold: number | null
  accountsWorked: number
  reorderWithin7: number
  reorderWithin14: number
  reorderWithin30: number
  avgDaysToReorder: number | null
  avgPullThroughScore: number | null
  accountIds: string[]
  /** Economics: retail tastings only, using each tasting's resolved cost. */
  tastingSpend: number
  reordersGenerated: number
  attributedCases: number
  avgCasesDepleted: number | null
  costPerCaseMoved: number | null
  costPerReorder: number | null
  avgRoi: number | null
  sustained: ReturnType<typeof tasterSustainedResults>
}

function average(values: number[]) {
  if (values.length === 0) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

export function computeTasterPerformance(
  tastingsByAccount: Map<string, PullThroughTasting[]>,
  rows: PullThroughAccountRow[],
  now: Date = new Date(),
): TasterPerformanceRow[] {
  const scoreByAccount = new Map(rows.map((row) => [row.accountId, row.pullThrough.score]))

  const buckets = new Map<
    string,
    {
      tasterUserId: string | null
      tasterName: string
      tastings: PullThroughTasting[]
      accountIds: Set<string>
    }
  >()

  for (const list of tastingsByAccount.values()) {
    for (const tasting of list) {
      // Unassigned tastings are grouped so the gap stays visible rather than vanishing.
      const key = tasting.tasterUserId ?? 'unassigned'
      const bucket = buckets.get(key) ?? {
        tasterUserId: tasting.tasterUserId,
        tasterName: tasting.tasterName ?? 'Unassigned',
        tastings: [],
        accountIds: new Set<string>(),
      }
      bucket.tastings.push(tasting)
      bucket.accountIds.add(tasting.accountId)
      buckets.set(key, bucket)
    }
  }

  return Array.from(buckets.values())
    .map((bucket) => {
      const withSales = bucket.tastings.filter((tasting) => tasting.bottlesSold != null)
      const totalBottlesSold = withSales.reduce((sum, tasting) => sum + (tasting.bottlesSold ?? 0), 0)
      const daysToReorder = bucket.tastings
        .map((tasting) => tasting.daysToNextOrder)
        .filter((value): value is number => value != null)

      const scores = Array.from(bucket.accountIds)
        .map((accountId) => scoreByAccount.get(accountId) ?? null)
        .filter((value): value is number => value != null)

      const retail = retailTastings(bucket.tastings)
      const tastingSpend = retail.reduce((sum, tasting) => sum + tasting.cost, 0)
      const attributedCases = retail.reduce((sum, tasting) => sum + (tasting.economics?.attributedCases ?? 0), 0)
      const reordersGenerated = retail.filter((tasting) => tasting.economics?.attributedOrderId != null).length
      const rois = retail.map((tasting) => tasting.economics?.roiPercent).filter((value): value is number => value != null)
      const casesMoved = retail.map((tasting) => (tasting.bottlesSold ?? 0) / 12 + (tasting.economics?.attributedCases ?? 0))

      return {
        tastingSpend: Math.round(tastingSpend * 100) / 100,
        reordersGenerated,
        attributedCases: Math.round(attributedCases * 10) / 10,
        avgCasesDepleted: casesMoved.length > 0 ? Math.round((average(casesMoved) ?? 0) * 100) / 100 : null,
        costPerCaseMoved: attributedCases > 0 ? Math.round(tastingSpend / attributedCases) : null,
        costPerReorder: reordersGenerated > 0 ? Math.round(tastingSpend / reordersGenerated) : null,
        avgRoi: rois.length > 0 ? Math.round(average(rois) ?? 0) : null,
        sustained: tasterSustainedResults(bucket.tastings, now),
        tasterUserId: bucket.tasterUserId,
        tasterName: bucket.tasterName,
        tastingsCompleted: bucket.tastings.filter((tasting) => tasting.status === 'completed').length,
        tastingsWithReport: bucket.tastings.filter((tasting) => tasting.hasReport).length,
        totalBottlesSold,
        avgBottlesSold: withSales.length > 0 ? totalBottlesSold / withSales.length : null,
        accountsWorked: bucket.accountIds.size,
        reorderWithin7: bucket.tastings.filter((tasting) => tasting.within7).length,
        reorderWithin14: bucket.tastings.filter((tasting) => tasting.within14).length,
        reorderWithin30: bucket.tastings.filter((tasting) => tasting.within30).length,
        avgDaysToReorder: average(daysToReorder),
        avgPullThroughScore: average(scores),
        accountIds: Array.from(bucket.accountIds),
      } satisfies TasterPerformanceRow
    })
    // Rank on sustained 60-day net, not bottles poured: the spec favours tasters whose
    // events lead to repeat orders over those who sell the most at the table.
    .sort((a, b) => (b.sustained.d60.net ?? -Infinity) - (a.sustained.d60.net ?? -Infinity) || b.totalBottlesSold - a.totalBottlesSold)
}

export type RepPerformanceRow = {
  salesRepId: string | null
  salesRepName: string
  accountsManaged: number
  activeAccounts: number
  hotAccounts: number
  newAccounts: number
  atRiskAccounts: number
  reorderRate: number | null
  avgReorderFrequency: number | null
  tastingsBooked: number
  /** Share of accounts with an inventory check inside the freshness window. */
  inventoryCheckCompliance: number | null
  avgPullThroughScore: number | null
}

export function computeRepPerformance(rows: PullThroughAccountRow[]): RepPerformanceRow[] {
  const buckets = new Map<string, { name: string; rows: PullThroughAccountRow[] }>()

  for (const row of rows) {
    const key = row.salesRepId ?? 'unassigned'
    const bucket = buckets.get(key) ?? { name: row.salesRepName ?? 'Unassigned', rows: [] }
    bucket.rows.push(row)
    buckets.set(key, bucket)
  }

  return Array.from(buckets.entries())
    .map(([key, bucket]) => {
      const withOrders = bucket.rows.filter((row) => row.orders.totalOrders > 0)
      const reordered = bucket.rows.filter((row) => row.orders.reorderCount > 0)
      const cadences = bucket.rows
        .map((row) => row.orders.avgDaysBetweenOrders)
        .filter((value): value is number => value != null)
      const scores = bucket.rows
        .map((row) => row.pullThrough.score)
        .filter((value): value is number => value != null)

      const fresh = bucket.rows.filter(
        (row) => row.inventory.daysSinceConfirmed != null && row.inventory.daysSinceConfirmed <= INVENTORY_STALE_DAYS,
      )

      return {
        salesRepId: key === 'unassigned' ? null : key,
        salesRepName: bucket.name,
        accountsManaged: bucket.rows.length,
        activeAccounts: withOrders.length,
        hotAccounts: bucket.rows.filter((row) => row.temperature === 'hot').length,
        newAccounts: bucket.rows.filter((row) => row.temperature === 'new').length,
        atRiskAccounts: bucket.rows.filter((row) => row.temperature === 'at_risk').length,
        reorderRate: withOrders.length > 0 ? (reordered.length / withOrders.length) * 100 : null,
        avgReorderFrequency: average(cadences),
        tastingsBooked: bucket.rows.reduce((sum, row) => sum + row.tastings.tastingCount, 0),
        inventoryCheckCompliance: bucket.rows.length > 0 ? (fresh.length / bucket.rows.length) * 100 : null,
        avgPullThroughScore: average(scores),
      } satisfies RepPerformanceRow
    })
    .sort((a, b) => b.accountsManaged - a.accountsManaged)
}
