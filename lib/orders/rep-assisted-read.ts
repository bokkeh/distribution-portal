import { and, eq, gt, isNull } from 'drizzle-orm'
import { db } from '@/db'
import { customerAccounts, invoices, orders, repAssistedOrders } from '@/db/schema'
import { hashRepAssistedAccessToken } from './rep-assisted-token'

export async function getRepAssistedOrderByToken(token: string) {
  const [result] = await db
    .select({ workflow: repAssistedOrders, account: customerAccounts, order: orders, invoice: invoices })
    .from(repAssistedOrders)
    .innerJoin(customerAccounts, eq(repAssistedOrders.customerId, customerAccounts.id))
    .innerJoin(orders, eq(repAssistedOrders.orderId, orders.id))
    .innerJoin(invoices, eq(repAssistedOrders.invoiceId, invoices.id))
    .where(and(
      eq(repAssistedOrders.accessTokenHash, hashRepAssistedAccessToken(token)),
      isNull(repAssistedOrders.revokedAt),
      gt(repAssistedOrders.accessTokenExpiresAt, new Date()),
    ))
    .limit(1)
  return result ?? null
}
