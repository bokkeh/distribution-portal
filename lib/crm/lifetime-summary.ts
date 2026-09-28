import 'server-only'

import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { historicalOrders, orders } from '@/db/schema'

export type LifetimeOrderSummary = {
  lifetimeOrderCount: number
  firstOrderDate: Date | null
  lastOrderDate: Date | null
  averageOrderValue: number | null
}

/**
 * Lifetime order stats for the CRM account overview (lifetime count, first/last order, avg value).
 * Unions live orders with backfilled `historicalOrders` for reporting only — kept separate from
 * lib/pull-through/metrics.ts, whose operational signals (reorder likelihood, temperature) must
 * stay based on real order cadence, not historical backfills.
 */
export async function getLifetimeOrderSummary(accountId: string): Promise<LifetimeOrderSummary> {
  const [liveOrders, backfilled] = await Promise.all([
    db
      .select({ createdAt: orders.createdAt, total: orders.total })
      .from(orders)
      .where(eq(orders.customerId, accountId)),
    db
      .select({ orderDate: historicalOrders.orderDate, orderValue: historicalOrders.orderValue })
      .from(historicalOrders)
      .where(eq(historicalOrders.accountId, accountId)),
  ])

  const dates: Date[] = [
    ...liveOrders.map((order) => order.createdAt),
    ...backfilled.map((order) => order.orderDate),
  ]
  const values: number[] = [
    ...liveOrders.map((order) => Number(order.total)),
    ...backfilled.filter((order) => order.orderValue != null).map((order) => Number(order.orderValue)),
  ]

  if (dates.length === 0) {
    return { lifetimeOrderCount: 0, firstOrderDate: null, lastOrderDate: null, averageOrderValue: null }
  }

  const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime())

  return {
    lifetimeOrderCount: liveOrders.length + backfilled.length,
    firstOrderDate: sorted[0],
    lastOrderDate: sorted[sorted.length - 1],
    averageOrderValue: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null,
  }
}
