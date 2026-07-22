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
  deltaWarehouseBottles = 0,
  deltaSampleBottles = 0,
  warehouseBottlesAfter = 0,
  sampleBottlesAfter = 0,
  checkedOutBottlesAfter = 0,
  sampleHolderUserId,
  sampleBottles = 0,
}: {
  productId: string
  actorUserId?: string | null
  orderId?: string | null
  type: 'product_created' | 'manual_adjustment' | 'sample_adjustment' | 'order_allocation' | 'inventory_transfer' | 'sample_checkout' | 'sample_return' | 'sample_disposition' | 'sample_disposition_undo'
  reason?: string | null
  deltaPaid?: number
  deltaSample?: number
  deltaLooseBottlePaid?: number
  quantityPaidAfter?: number
  quantitySampleAfter?: number
  looseBottlePaidAfter?: number
  deltaWarehouseBottles?: number
  deltaSampleBottles?: number
  warehouseBottlesAfter?: number
  sampleBottlesAfter?: number
  checkedOutBottlesAfter?: number
  sampleHolderUserId?: string | null
  sampleBottles?: number
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
      deltaWarehouseBottles,
      deltaSampleBottles,
      warehouseBottlesAfter,
      sampleBottlesAfter,
      checkedOutBottlesAfter,
      sampleHolderUserId: sampleHolderUserId ?? null,
      sampleBottles,
    })
  } catch (error) {
    if (isMissingInventoryTransactionsTable(error)) {
      console.warn('inventory_transactions table is missing; skipping inventory history log')
      return
    }
    throw error
  }
}
