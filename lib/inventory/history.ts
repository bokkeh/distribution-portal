import 'server-only'

import { db } from '@/db'
import { inventoryTransactions } from '@/db/schema'

function isMissingInventoryTransactionsTable(error: unknown) {
  if (!(error instanceof Error)) return false
  const code = (error as Error & { code?: string; cause?: { code?: string } }).code
  const causeCode = (error as Error & { cause?: { code?: string } }).cause?.code
  const message = error.message.toLowerCase()
  return code === '42P01'
    || causeCode === '42P01'
    || message.includes('inventory_transactions')
    || message.includes('relation "inventory_transactions" does not exist')
}

export async function logInventoryTransaction({
  productId,
  actorUserId,
  orderId,
  type,
  reason,
  deltaPaid = 0,
  deltaSample = 0,
  deltaLooseBottlePaid = 0,
  quantityPaidAfter = 0,
  quantitySampleAfter = 0,
  looseBottlePaidAfter = 0,
}: {
  productId: string
  actorUserId?: string | null
  orderId?: string | null
  type: 'product_created' | 'manual_adjustment' | 'sample_adjustment' | 'order_allocation'
  reason?: string | null
  deltaPaid?: number
  deltaSample?: number
  deltaLooseBottlePaid?: number
  quantityPaidAfter?: number
  quantitySampleAfter?: number
  looseBottlePaidAfter?: number
}) {
  try {
    await db.insert(inventoryTransactions).values({
      productId,
      actorUserId: actorUserId ?? null,
      orderId: orderId ?? null,
      type,
      reason: reason ?? null,
      deltaPaid,
      deltaSample,
      deltaLooseBottlePaid,
      quantityPaidAfter,
      quantitySampleAfter,
      looseBottlePaidAfter,
    })
  } catch (error) {
    if (isMissingInventoryTransactionsTable(error)) {
      console.warn('inventory_transactions table is missing; skipping inventory history log')
      return
    }
    throw error
  }
}
