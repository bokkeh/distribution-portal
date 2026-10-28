import 'server-only'

import { and, eq, ne } from 'drizzle-orm'
import { db } from '@/db'
import { orders } from '@/db/schema'
import { readHistoricalPurchases } from '@/lib/orders/history-read'

export type LifetimeOrderSummary = {
  lifetimeOrderCount: number
  firstOrderDate: Date | null
  lastOrderDate: Date | null
  averageOrderValue: number | null
  averageGapDays: number | null
  excludedDuplicates: number
  excludedIds: string[]
  history: Array<{ id: string; date: Date; source: string; total: number | null }>
}

/** Commercial live orders plus reconciled historical purchases, sharing the economics input rules.
 * Counts and dates describe recorded coverage; they do not certify a first-ever purchase.
 */
export async function getLifetimeOrderSummary(accountId: string): Promise<LifetimeOrderSummary> {
  const [liveOrders, backfilled] = await Promise.all([
    db
      .select({ id: orders.id, createdAt: orders.createdAt, total: orders.total })
      .from(orders)
      .where(and(eq(orders.customerId, accountId), eq(orders.orderType, 'paid'), ne(orders.status, 'cancelled'))),
    readHistoricalPurchases([accountId]),
  ])

  const dates: Date[] = [
    ...liveOrders.map((order) => order.createdAt),
    ...backfilled.purchases.map((order) => order.date),
  ]
  const values: number[] = [
    ...liveOrders.map((order) => Number(order.total)),
    ...backfilled.purchases.filter((order) => order.revenueKnown).map((order) => order.total),
  ]

  if (dates.length === 0) {
    return { lifetimeOrderCount: 0, firstOrderDate: null, lastOrderDate: null, averageOrderValue: null, averageGapDays: null, excludedDuplicates: backfilled.excluded.length, excludedIds: backfilled.excluded.map(r=>r.id), history: [] }
  }

  const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime())

  return {
    history: [...liveOrders.map(o=>({id:o.id,date:o.createdAt,source:'Live order',total:Number(o.total)})), ...backfilled.purchases.map(o=>({id:o.id,date:o.date,source:'Historical purchase',total:o.revenueKnown ? o.total : null}))].sort((a,b)=>b.date.getTime()-a.date.getTime()),
    lifetimeOrderCount: liveOrders.length + backfilled.purchases.length,
    averageGapDays: sorted.length > 1 ? (sorted[sorted.length - 1].getTime() - sorted[0].getTime()) / 86400000 / (sorted.length - 1) : null,
    excludedDuplicates: backfilled.excluded.length,
    excludedIds: backfilled.excluded.map(r=>r.id),
    firstOrderDate: sorted[0],
    lastOrderDate: sorted[sorted.length - 1],
    averageOrderValue: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null,
  }
}
