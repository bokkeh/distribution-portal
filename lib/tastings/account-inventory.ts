import 'server-only'

import { and, eq, inArray, like } from 'drizzle-orm'
import { db } from '@/db'
import {
  accountInventoryAdjustments,
  accountInventoryOnHand,
  products,
  tastingProducts,
  tastingReports,
  tastings,
} from '@/db/schema'
import { logActivityEvent } from '@/lib/activity/log'
import {
  insertAccountInventoryAdjustment,
  rebuildAccountInventorySnapshot,
  roundInventoryValue,
  toInventoryFixed,
} from '@/lib/crm/account-inventory-ledger'
import { formatEasternDateTime } from '@/lib/tastings/time'

/**
 * Every ledger entry written from a tasting report starts with this prefix. It doubles
 * as the idempotency key (together with account, product and the tasting's end time),
 * so resubmitting a report corrects the existing count instead of adding a second one.
 */
const NOTE_PREFIX = 'Tasting report:'

export type TastingInventorySyncResult =
  | { applied: true; productName: string; bottles: number; previousBottles: number | null; updated: boolean }
  | { applied: false; reason: string }

/**
 * The report's "bottles in stock after tasting" is a single physical count of the
 * store's Wisher stock, so it maps to one product. Prefer the product attached to the
 * tasting, then the only product the account already stocks, then the only active
 * product in the catalog. Anything ambiguous is left for a person to resolve.
 */
async function resolveTastingProduct(tastingId: string, accountId: string) {
  const attached = await db
    .select({ productId: tastingProducts.productId })
    .from(tastingProducts)
    .where(eq(tastingProducts.tastingId, tastingId))
  const attachedIds = Array.from(new Set(attached.map((row) => row.productId)))

  let productId: string | null = null
  if (attachedIds.length === 1) {
    productId = attachedIds[0]
  } else if (attachedIds.length === 0) {
    const stocked = await db
      .select({ productId: accountInventoryOnHand.productId })
      .from(accountInventoryOnHand)
      .where(eq(accountInventoryOnHand.accountId, accountId))
    const stockedIds = Array.from(new Set(stocked.map((row) => row.productId)))

    if (stockedIds.length === 1) {
      productId = stockedIds[0]
    } else if (stockedIds.length === 0) {
      const active = await db.select({ id: products.id }).from(products).where(eq(products.active, true))
      if (active.length === 1) productId = active[0].id
    }
  }

  if (!productId) return null

  const [product] = await db
    .select({ id: products.id, sku: products.sku, name: products.name })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1)
  return product ?? null
}

/**
 * Records the after-tasting bottle count from a submitted tasting report as an
 * absolute inventory check on the account, exactly as a manual inventory check would
 * be. Safe to call repeatedly for the same tasting.
 */
export async function syncTastingReportInventory(input: {
  tastingId: string
  actorUserId: string
}): Promise<TastingInventorySyncResult> {
  const [row] = await db
    .select({
      tastingId: tastings.id,
      accountId: tastings.customerId,
      eventName: tastings.eventName,
      scheduledAt: tastings.scheduledAt,
      endAt: tastings.endAt,
      bottlesInStockBefore: tastingReports.bottlesInStockBefore,
      bottlesInStockAfter: tastingReports.bottlesInStockAfter,
      bottlesSold: tastingReports.bottlesSold,
      submittedByUserId: tastingReports.submittedByUserId,
    })
    .from(tastings)
    .innerJoin(tastingReports, eq(tastingReports.tastingId, tastings.id))
    .where(eq(tastings.id, input.tastingId))
    .limit(1)

  if (!row) return { applied: false, reason: 'No submitted report found for this tasting.' }
  if (row.bottlesInStockAfter == null) {
    return { applied: false, reason: 'The report does not include an after-tasting bottle count.' }
  }

  const product = await resolveTastingProduct(row.tastingId, row.accountId)
  if (!product) {
    const reason = 'Could not tell which product the bottle count refers to — record the count on the account manually.'
    await logActivityEvent({
      entityType: 'account',
      entityId: row.accountId,
      actorUserId: input.actorUserId,
      kind: 'account_inventory_sync_skipped',
      title: 'Inventory not updated from tasting report',
      body: `${row.eventName}: ${reason}`,
      metadata: { tastingId: row.tastingId },
    })
    return { applied: false, reason }
  }

  // The count was taken when the tasting wrapped up, so that is when it takes effect
  // in the ledger — not when the taster got around to submitting the report.
  const now = new Date()
  const countedAt = row.endAt ?? row.scheduledAt
  const effectiveAt = countedAt > now ? now : countedAt
  const bottles = roundInventoryValue(row.bottlesInStockAfter)

  const soldDuring =
    row.bottlesInStockBefore != null ? Math.max(0, row.bottlesInStockBefore - row.bottlesInStockAfter) : row.bottlesSold
  const notes = [
    `${NOTE_PREFIX} counted after "${row.eventName}" on ${formatEasternDateTime(countedAt)}.`,
    row.bottlesInStockBefore != null ? `${row.bottlesInStockBefore} bottles before the tasting.` : null,
    soldDuring != null && soldDuring > 0 ? `${soldDuring} sold during the event.` : null,
  ]
    .filter(Boolean)
    .join(' ')

  const [[existingItem], [existingEntry]] = await Promise.all([
    db
      .select({ id: accountInventoryOnHand.id, bottlesOnHand: accountInventoryOnHand.bottlesOnHand })
      .from(accountInventoryOnHand)
      .where(and(eq(accountInventoryOnHand.accountId, row.accountId), eq(accountInventoryOnHand.productId, product.id)))
      .limit(1),
    db
      .select({ id: accountInventoryAdjustments.id, recordedBottlesOnHand: accountInventoryAdjustments.recordedBottlesOnHand })
      .from(accountInventoryAdjustments)
      .where(
        and(
          eq(accountInventoryAdjustments.accountId, row.accountId),
          eq(accountInventoryAdjustments.productId, product.id),
          eq(accountInventoryAdjustments.effectiveAt, effectiveAt),
          inArray(accountInventoryAdjustments.changeType, ['manual_add', 'manual_update', 'manual_edit']),
          like(accountInventoryAdjustments.notes, `${NOTE_PREFIX}%`),
        ),
      )
      .limit(1),
  ])

  const previousBottles = existingItem ? roundInventoryValue(Number(existingItem.bottlesOnHand)) : null

  if (existingEntry) {
    const unchanged = toInventoryFixed(Number(existingEntry.recordedBottlesOnHand ?? 0)) === toInventoryFixed(bottles)
    await db
      .update(accountInventoryAdjustments)
      .set({
        recordedBottlesOnHand: toInventoryFixed(bottles),
        notes,
        updatedByUserId: input.actorUserId,
        updatedAt: new Date(),
      })
      .where(eq(accountInventoryAdjustments.id, existingEntry.id))
    await rebuildAccountInventorySnapshot({ accountId: row.accountId, productId: product.id })
    if (unchanged) {
      return { applied: true, productName: product.name, bottles, previousBottles, updated: false }
    }
  } else {
    await insertAccountInventoryAdjustment({
      accountId: row.accountId,
      productId: product.id,
      inventoryItemId: existingItem?.id ?? null,
      sku: product.sku,
      productName: product.name,
      changeType: existingItem ? 'manual_update' : 'manual_add',
      deltaBottles: previousBottles == null ? bottles : roundInventoryValue(bottles - previousBottles),
      recordedBottlesOnHand: bottles,
      effectiveAt,
      notes,
      actorUserId: input.actorUserId,
    })
    await rebuildAccountInventorySnapshot({ accountId: row.accountId, productId: product.id })
  }

  await logActivityEvent({
    entityType: 'account',
    entityId: row.accountId,
    actorUserId: input.actorUserId,
    kind: 'account_inventory_updated',
    title: existingEntry ? 'Tasting count corrected' : 'Inventory counted at tasting',
    body:
      previousBottles == null
        ? `${product.name} recorded at ${toInventoryFixed(bottles)} bottles after "${row.eventName}".`
        : `${product.name} counted at ${toInventoryFixed(bottles)} bottles after "${row.eventName}" (was ${toInventoryFixed(previousBottles)}).`,
    metadata: {
      tastingId: row.tastingId,
      productId: product.id,
      sku: product.sku,
      productName: product.name,
      effectiveAt: effectiveAt.toISOString(),
      before: { bottlesOnHand: previousBottles == null ? null : toInventoryFixed(previousBottles) },
      after: { bottlesOnHand: toInventoryFixed(bottles) },
    },
  })

  return { applied: true, productName: product.name, bottles, previousBottles, updated: Boolean(existingEntry) }
}
