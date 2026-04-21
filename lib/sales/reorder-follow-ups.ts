import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import { db } from '@/db'
import { accountInventoryOnHand, orderItems, orders } from '@/db/schema'

export const LOW_INVENTORY_CASE_THRESHOLD = 1
export const SINGLE_CASE_REORDER_DELAY_DAYS = 60

type AccountInput = {
  id: string
  companyName: string | null
}

export type ReorderFollowUp = {
  accountId: string
  companyName: string
  daysSinceLastOrder: number | null
  lastOrderAt: Date | null
  latestOrderCaseQuantity: number | null
  lowInventoryProductCount: number
  lowestCasesOnHand: number | null
  reason: string
}

function getDaysSince(date: Date, now: Date) {
  return Math.floor((now.getTime() - date.getTime()) / 86400000)
}

export async function getReorderFollowUps(accounts: AccountInput[]): Promise<ReorderFollowUp[]> {
  if (accounts.length === 0) return []

  const now = new Date()
  const accountIds = accounts.map(account => account.id)

  const latestOrders = await db
    .select({
      id: orders.id,
      customerId: orders.customerId,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(and(
      inArray(orders.customerId, accountIds),
      sql`${orders.status} <> 'cancelled'`,
    ))
    .orderBy(desc(orders.createdAt))

  const latestOrderByAccount = new Map<string, { id: string; createdAt: Date }>()
  for (const order of latestOrders) {
    if (!latestOrderByAccount.has(order.customerId)) {
      latestOrderByAccount.set(order.customerId, {
        id: order.id,
        createdAt: new Date(order.createdAt),
      })
    }
  }

  const latestOrderIds = Array.from(latestOrderByAccount.values()).map(order => order.id)

  const latestOrderCaseRows = latestOrderIds.length > 0
    ? await db
        .select({
          orderId: orderItems.orderId,
          cases: sql<number>`coalesce(sum(${orderItems.quantity}::numeric), 0)::float`.as('cases'),
        })
        .from(orderItems)
        .where(and(
          inArray(orderItems.orderId, latestOrderIds),
          eq(orderItems.unit, 'case'),
        ))
        .groupBy(orderItems.orderId)
    : []

  const latestOrderCasesById = new Map(latestOrderCaseRows.map(row => [row.orderId, Number(row.cases ?? 0)]))

  const lowInventoryRows = await db
    .select({
      accountId: accountInventoryOnHand.accountId,
      lowInventoryProductCount: sql<number>`count(*)::int`.as('low_inventory_product_count'),
      lowestCasesOnHand: sql<number>`min(${accountInventoryOnHand.casesOnHand}::numeric)::float`.as('lowest_cases_on_hand'),
    })
    .from(accountInventoryOnHand)
    .where(and(
      inArray(accountInventoryOnHand.accountId, accountIds),
      sql`${accountInventoryOnHand.casesOnHand} <= ${LOW_INVENTORY_CASE_THRESHOLD}`,
    ))
    .groupBy(accountInventoryOnHand.accountId)

  const lowInventoryByAccount = new Map(lowInventoryRows.map(row => [
    row.accountId,
    {
      lowInventoryProductCount: Number(row.lowInventoryProductCount ?? 0),
      lowestCasesOnHand: row.lowestCasesOnHand == null ? null : Number(row.lowestCasesOnHand),
    },
  ]))

  return accounts
    .map((account) => {
      const latestOrder = latestOrderByAccount.get(account.id) ?? null
      const daysSinceLastOrder = latestOrder ? getDaysSince(latestOrder.createdAt, now) : null
      const latestOrderCaseQuantity = latestOrder ? (latestOrderCasesById.get(latestOrder.id) ?? 0) : null
      const lowInventory = lowInventoryByAccount.get(account.id)
      const hasLowInventory = (lowInventory?.lowInventoryProductCount ?? 0) > 0
      const isSingleCaseOrder = latestOrderCaseQuantity === 1
      const singleCaseDelayMet = isSingleCaseOrder && daysSinceLastOrder != null && daysSinceLastOrder >= SINGLE_CASE_REORDER_DELAY_DAYS

      if (!hasLowInventory && !singleCaseDelayMet) {
        return null
      }

      if (hasLowInventory && isSingleCaseOrder && !singleCaseDelayMet) {
        return null
      }

      let reason = `${lowInventory?.lowInventoryProductCount ?? 0} product${(lowInventory?.lowInventoryProductCount ?? 0) === 1 ? '' : 's'} at or below ${LOW_INVENTORY_CASE_THRESHOLD} case left`
      if (!hasLowInventory) {
        reason = `Latest ${latestOrderCaseQuantity}-case order is ${SINGLE_CASE_REORDER_DELAY_DAYS}+ days old`
      } else if (isSingleCaseOrder) {
        reason = `1 case left and the latest 1-case order is ${daysSinceLastOrder} days old`
      }

      return {
        accountId: account.id,
        companyName: account.companyName ?? 'Unnamed account',
        daysSinceLastOrder,
        lastOrderAt: latestOrder?.createdAt ?? null,
        latestOrderCaseQuantity,
        lowInventoryProductCount: lowInventory?.lowInventoryProductCount ?? 0,
        lowestCasesOnHand: lowInventory?.lowestCasesOnHand ?? null,
        reason,
      } satisfies ReorderFollowUp
    })
    .filter((value): value is ReorderFollowUp => value !== null)
    .sort((left, right) => {
      if (left.lowInventoryProductCount !== right.lowInventoryProductCount) {
        return right.lowInventoryProductCount - left.lowInventoryProductCount
      }

      return (right.daysSinceLastOrder ?? -1) - (left.daysSinceLastOrder ?? -1)
    })
}
