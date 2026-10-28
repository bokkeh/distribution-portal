import 'server-only'
import { db } from '@/db'
import { historicalOrders, orders, orderItems, products } from '@/db/schema'
import { and, eq, inArray, ne, asc, sql } from 'drizzle-orm'
import { reconcileHistoricalPurchases, groupHistoricalPurchases } from './history-reconciliation'
export async function readHistoricalPurchases(accountIds: string[]) {
  if (!accountIds.length) return { purchases: [], excluded: [] }
  const [history, live] = await Promise.all([
    db.select({ id: historicalOrders.id, accountId: historicalOrders.accountId, orderDate: historicalOrders.orderDate, productId: historicalOrders.productId, productNameFreeform: historicalOrders.productNameFreeform, cases: historicalOrders.cases, bottles: historicalOrders.bottles, orderValue: historicalOrders.orderValue, externalReference: historicalOrders.externalReference, duplicateReviewReason: historicalOrders.duplicateReviewReason, fulfillmentStatus: historicalOrders.fulfillmentStatus, bottlesPerCase: products.bottlesPerCase }).from(historicalOrders).leftJoin(products, eq(products.id, historicalOrders.productId)).where(inArray(historicalOrders.accountId, accountIds)).orderBy(asc(historicalOrders.createdAt)),
    db.select({ accountId: orders.customerId, orderId: orders.id, date: sql<string>`to_char(${orders.createdAt} AT TIME ZONE 'America/New_York', 'YYYY-MM-DD')`, productId: orderItems.productId, unit: orderItems.unit, quantity: orderItems.quantity, value: orderItems.total }).from(orders).innerJoin(orderItems, eq(orderItems.orderId, orders.id)).where(and(inArray(orders.customerId, accountIds), eq(orders.orderType, 'paid'), ne(orders.status, 'cancelled'))),
  ])
  const reconciled = reconcileHistoricalPurchases(history, live.map(r => ({ ...r, cases: r.unit === 'case' ? Number(r.quantity) : 0, bottles: r.unit === 'bottle' ? Number(r.quantity) : 0, value: Number(r.value) })))
  return { purchases: groupHistoricalPurchases(reconciled.included), excluded: reconciled.excluded }
}
