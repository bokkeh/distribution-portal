import 'server-only'

import { and, asc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { accountInventoryAdjustments, accountInventoryOnHand, products } from '@/db/schema'

export type AccountInventoryChangeType = 'manual_add' | 'manual_update' | 'manual_remove' | 'manual_edit' | 'order_fulfillment'

export function roundInventoryValue(value: number) {
  return Math.round(value * 100) / 100
}

export function toInventoryFixed(value: number) {
  return roundInventoryValue(value).toFixed(2)
}

export async function rebuildAccountInventorySnapshot(input: {
  accountId: string
  productId: string
}) {
  const [adjustments, [product], [existingItem]] = await Promise.all([
    db
      .select()
      .from(accountInventoryAdjustments)
      .where(and(
        eq(accountInventoryAdjustments.accountId, input.accountId),
        eq(accountInventoryAdjustments.productId, input.productId),
      ))
      .orderBy(
        asc(accountInventoryAdjustments.effectiveAt),
        asc(accountInventoryAdjustments.createdAt),
        asc(accountInventoryAdjustments.id),
      ),
    db
      .select({
        id: products.id,
        sku: products.sku,
        name: products.name,
        unit: products.unit,
        bottlesPerCase: products.bottlesPerCase,
      })
      .from(products)
      .where(eq(products.id, input.productId))
      .limit(1),
    db
      .select()
      .from(accountInventoryOnHand)
      .where(and(
        eq(accountInventoryOnHand.accountId, input.accountId),
        eq(accountInventoryOnHand.productId, input.productId),
      ))
      .limit(1),
  ])

  if (!product) throw new Error('Product not found.')

  let runningBottles = 0

  for (const adjustment of adjustments) {
    const additiveBottleDelta = roundInventoryValue(
      Number(adjustment.deltaBottles ?? 0)
        + Number(adjustment.deltaCases ?? 0) * product.bottlesPerCase,
    )
    const previousBottles = runningBottles
    const recordedBottles = adjustment.recordedBottlesOnHand == null
      ? null
      : roundInventoryValue(Number(adjustment.recordedBottlesOnHand))

    runningBottles = recordedBottles == null
      ? roundInventoryValue(runningBottles + additiveBottleDelta)
      : recordedBottles
    const effectiveBottleDelta = roundInventoryValue(runningBottles - previousBottles)

    await db.update(accountInventoryAdjustments).set({
      deltaCases: '0.00',
      deltaBottles: toInventoryFixed(effectiveBottleDelta),
      recordedBottlesOnHand: recordedBottles == null ? null : toInventoryFixed(recordedBottles),
      resultingCasesOnHand: '0.00',
      resultingBottlesOnHand: toInventoryFixed(runningBottles),
    }).where(eq(accountInventoryAdjustments.id, adjustment.id))
  }

  const finalBottles = toInventoryFixed(runningBottles)
  const finalIsZero = Number(finalBottles) === 0
  const latestAdjustment = adjustments[adjustments.length - 1]

  if (!latestAdjustment || finalIsZero) {
    if (existingItem) await db.delete(accountInventoryOnHand).where(eq(accountInventoryOnHand.id, existingItem.id))

    await db
      .update(accountInventoryAdjustments)
      .set({ inventoryItemId: null })
      .where(and(
        eq(accountInventoryAdjustments.accountId, input.accountId),
        eq(accountInventoryAdjustments.productId, input.productId),
      ))
    return
  }

  const updatedByUserId = latestAdjustment.updatedByUserId ?? latestAdjustment.createdByUserId ?? null
  const updatedAt = latestAdjustment.effectiveAt
  let itemId = existingItem?.id ?? null

  if (existingItem) {
    await db.update(accountInventoryOnHand).set({
      sku: product.sku,
      productName: product.name,
      unitType: 'bottle',
      casesOnHand: '0.00',
      bottlesOnHand: finalBottles,
      quantityOnHand: finalBottles,
      updatedByUserId,
      updatedAt,
    }).where(eq(accountInventoryOnHand.id, existingItem.id))
  } else {
    const [insertedItem] = await db.insert(accountInventoryOnHand).values({
      accountId: input.accountId,
      productId: input.productId,
      sku: product.sku,
      productName: product.name,
      unitType: 'bottle',
      casesOnHand: '0.00',
      bottlesOnHand: finalBottles,
      quantityOnHand: finalBottles,
      updatedByUserId,
      updatedAt,
    }).returning({ id: accountInventoryOnHand.id })
    itemId = insertedItem.id
  }

  if (itemId) {
    await db
      .update(accountInventoryAdjustments)
      .set({ inventoryItemId: itemId })
      .where(and(
        eq(accountInventoryAdjustments.accountId, input.accountId),
        eq(accountInventoryAdjustments.productId, input.productId),
      ))
  }
}

export async function insertAccountInventoryAdjustment(input: {
  accountId: string
  productId: string
  inventoryItemId?: string | null
  sourceOrderId?: string | null
  sku: string
  productName: string
  changeType: AccountInventoryChangeType
  deltaBottles: number
  recordedBottlesOnHand?: number | null
  effectiveAt: Date
  notes?: string | null
  actorUserId: string
}) {
  const inserted = await db.insert(accountInventoryAdjustments).values({
    accountId: input.accountId,
    productId: input.productId,
    inventoryItemId: input.inventoryItemId ?? null,
    sourceOrderId: input.sourceOrderId ?? null,
    sku: input.sku,
    productName: input.productName,
    changeType: input.changeType,
    deltaCases: '0.00',
    deltaBottles: toInventoryFixed(input.deltaBottles),
    recordedBottlesOnHand: input.recordedBottlesOnHand == null
      ? null
      : toInventoryFixed(input.recordedBottlesOnHand),
    resultingCasesOnHand: '0.00',
    resultingBottlesOnHand: '0.00',
    effectiveAt: input.effectiveAt,
    notes: input.notes ?? null,
    createdByUserId: input.actorUserId,
    updatedByUserId: input.actorUserId,
    updatedAt: new Date(),
  }).onConflictDoNothing().returning({ id: accountInventoryAdjustments.id })

  return inserted[0] ?? null
}
