import 'server-only'

import { db } from '@/db'
import { inventoryTransactions } from '@/db/schema'

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
}
