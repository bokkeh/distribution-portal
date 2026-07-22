'use server'

import { auth } from '@/lib/auth/config'
import { requireAdminOrStaff } from '@/lib/auth/session'
import { db } from '@/db'
import { inventory, inventorySampleHolders, products } from '@/db/schema'
import { and, eq, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { logInventoryTransaction } from '@/lib/inventory/history'
import { toBottles } from '@/lib/inventory/units'

type AllocationResult = { success: true } | { error: string }

function positiveInteger(value: FormDataEntryValue | null) {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

async function productContext(productId: string) {
  const [row] = await db.select({ bottlesPerCase: products.bottlesPerCase }).from(products).where(eq(products.id, productId)).limit(1)
  return row
}

async function snapshot(productId: string, bottlesPerCase: number) {
  const [stock] = await db.select().from(inventory).where(eq(inventory.productId, productId)).limit(1)
  const [holders] = await db.select({ total: sql<number>`coalesce(sum(${inventorySampleHolders.quantity} * ${bottlesPerCase} + ${inventorySampleHolders.looseBottleQuantity}), 0)` })
    .from(inventorySampleHolders).where(eq(inventorySampleHolders.productId, productId))
  return {
    warehouse: toBottles(stock?.quantityPaid ?? 0, stock?.looseBottlePaid ?? 0, bottlesPerCase),
    samples: toBottles(stock?.quantitySample ?? 0, stock?.looseBottleSample ?? 0, bottlesPerCase),
    checkedOut: Number(holders?.total ?? 0),
  }
}

export async function transferInventory(formData: FormData): Promise<AllocationResult> {
  await requireAdminOrStaff()
  const productId = String(formData.get('productId') ?? '')
  const direction = String(formData.get('direction') ?? '')
  const quantity = positiveInteger(formData.get('quantity'))
  const unit = String(formData.get('unit') ?? 'bottles')
  const context = await productContext(productId)
  if (!context || !quantity || !['warehouse_to_samples', 'samples_to_warehouse'].includes(direction)) return { error: 'Choose a valid product, direction, and quantity.' }

  const amount = unit === 'cases' ? quantity * context.bottlesPerCase : quantity
  const before = await snapshot(productId, context.bottlesPerCase)
  const source = direction === 'warehouse_to_samples' ? before.warehouse : before.samples
  if (source < amount) return { error: 'There is not enough stock in the selected source.' }
  const warehouseDelta = direction === 'warehouse_to_samples' ? -amount : amount
  const sampleDelta = -warehouseDelta

  const [updated] = await db.update(inventory).set({
    quantityPaid: sql`floor(((${inventory.quantityPaid} * ${context.bottlesPerCase} + ${inventory.looseBottlePaid}) + ${warehouseDelta})::numeric / ${context.bottlesPerCase})::integer`,
    looseBottlePaid: sql`((${inventory.quantityPaid} * ${context.bottlesPerCase} + ${inventory.looseBottlePaid}) + ${warehouseDelta}) % ${context.bottlesPerCase}`,
    quantitySample: sql`floor(((${inventory.quantitySample} * ${context.bottlesPerCase} + ${inventory.looseBottleSample}) + ${sampleDelta})::numeric / ${context.bottlesPerCase})::integer`,
    looseBottleSample: sql`((${inventory.quantitySample} * ${context.bottlesPerCase} + ${inventory.looseBottleSample}) + ${sampleDelta}) % ${context.bottlesPerCase}`,
    updatedAt: new Date(),
  }).where(and(
    eq(inventory.productId, productId),
    direction === 'warehouse_to_samples'
      ? sql`${inventory.quantityPaid} * ${context.bottlesPerCase} + ${inventory.looseBottlePaid} >= ${amount}`
      : sql`${inventory.quantitySample} * ${context.bottlesPerCase} + ${inventory.looseBottleSample} >= ${amount}`,
  )).returning({ productId: inventory.productId })
  if (!updated) return { error: 'Inventory changed while you were allocating it. Please try again.' }
  const after = await snapshot(productId, context.bottlesPerCase)

  await logInventoryTransaction({
    productId,
    actorUserId: (await auth())?.user?.id ?? null,
    type: 'inventory_transfer',
    reason: direction === 'warehouse_to_samples' ? 'Moved warehouse stock to samples' : 'Returned sample stock to warehouse',
    deltaWarehouseBottles: warehouseDelta,
    deltaSampleBottles: sampleDelta,
    warehouseBottlesAfter: after.warehouse,
    sampleBottlesAfter: after.samples,
    checkedOutBottlesAfter: after.checkedOut,
  })
  revalidatePath('/admin/inventory')
  return { success: true }
}

export async function checkoutSamples(formData: FormData): Promise<AllocationResult> {
  await requireAdminOrStaff()
  const productId = String(formData.get('productId') ?? '')
  const userId = String(formData.get('userId') ?? '')
  const quantity = positiveInteger(formData.get('quantity'))
  const unit = String(formData.get('unit') ?? 'bottles')
  const notes = String(formData.get('notes') ?? '').trim() || null
  const context = await productContext(productId)
  if (!context || !userId || !quantity) return { error: 'Choose a staff member and quantity.' }
  const amount = unit === 'cases' ? quantity * context.bottlesPerCase : quantity
  const result = await db.execute(sql`
    WITH moved AS (
      UPDATE inventory SET
        quantity_sample = floor(((quantity_sample * ${context.bottlesPerCase} + loose_bottle_sample) - ${amount})::numeric / ${context.bottlesPerCase})::integer,
        loose_bottle_sample = ((quantity_sample * ${context.bottlesPerCase} + loose_bottle_sample) - ${amount}) % ${context.bottlesPerCase},
        updated_at = now()
      WHERE product_id = ${productId} AND quantity_sample * ${context.bottlesPerCase} + loose_bottle_sample >= ${amount}
      RETURNING product_id
    )
    INSERT INTO inventory_sample_holders (product_id, user_id, quantity, loose_bottle_quantity, notes)
    SELECT product_id, ${userId}, floor(${amount}::numeric / ${context.bottlesPerCase})::integer, ${amount} % ${context.bottlesPerCase}, ${notes}
    FROM moved
    ON CONFLICT (product_id, user_id) DO UPDATE SET
      quantity = floor(((inventory_sample_holders.quantity * ${context.bottlesPerCase} + inventory_sample_holders.loose_bottle_quantity) + ${amount})::numeric / ${context.bottlesPerCase})::integer,
      loose_bottle_quantity = ((inventory_sample_holders.quantity * ${context.bottlesPerCase} + inventory_sample_holders.loose_bottle_quantity) + ${amount}) % ${context.bottlesPerCase},
      notes = coalesce(${notes}, inventory_sample_holders.notes)
    RETURNING product_id
  `)
  if ((result.rows?.length ?? 0) === 0) return { error: 'There are not enough sample bottles available.' }
  const after = await snapshot(productId, context.bottlesPerCase)
  await logInventoryTransaction({ productId, actorUserId: (await auth())?.user?.id ?? null, type: 'sample_checkout', reason: 'Checked samples out to staff', deltaSampleBottles: -amount, warehouseBottlesAfter: after.warehouse, sampleBottlesAfter: after.samples, checkedOutBottlesAfter: after.checkedOut })
  revalidatePath('/admin/inventory')
  return { success: true }
}

export async function closeSampleAssignment(formData: FormData): Promise<AllocationResult> {
  await requireAdminOrStaff()
  const holderId = String(formData.get('holderId') ?? '')
  const disposition = String(formData.get('disposition') ?? 'returned')
  const [holder] = await db.select({ id: inventorySampleHolders.id, productId: inventorySampleHolders.productId, quantity: inventorySampleHolders.quantity, loose: inventorySampleHolders.looseBottleQuantity, bottlesPerCase: products.bottlesPerCase })
    .from(inventorySampleHolders).innerJoin(products, eq(products.id, inventorySampleHolders.productId)).where(eq(inventorySampleHolders.id, holderId)).limit(1)
  if (!holder) return { error: 'Sample assignment was not found.' }
  const amount = toBottles(holder.quantity, holder.loose, holder.bottlesPerCase)
  if (disposition === 'returned') {
    const result = await db.execute(sql`
      WITH removed AS (
        DELETE FROM inventory_sample_holders WHERE id = ${holderId} RETURNING product_id
      )
      UPDATE inventory SET
        quantity_sample = floor(((quantity_sample * ${holder.bottlesPerCase} + loose_bottle_sample) + ${amount})::numeric / ${holder.bottlesPerCase})::integer,
        loose_bottle_sample = ((quantity_sample * ${holder.bottlesPerCase} + loose_bottle_sample) + ${amount}) % ${holder.bottlesPerCase},
        updated_at = now()
      WHERE product_id = (SELECT product_id FROM removed)
      RETURNING product_id
    `)
    if ((result.rows?.length ?? 0) === 0) return { error: 'Sample assignment changed. Please refresh and try again.' }
  } else {
    await db.delete(inventorySampleHolders).where(eq(inventorySampleHolders.id, holderId))
  }
  const after = await snapshot(holder.productId, holder.bottlesPerCase)
  await logInventoryTransaction({ productId: holder.productId, actorUserId: (await auth())?.user?.id ?? null, type: disposition === 'returned' ? 'sample_return' : 'sample_disposition', reason: disposition === 'returned' ? 'Samples returned to stock' : `Samples marked ${disposition}`, deltaSampleBottles: disposition === 'returned' ? amount : 0, warehouseBottlesAfter: after.warehouse, sampleBottlesAfter: after.samples, checkedOutBottlesAfter: after.checkedOut })
  revalidatePath('/admin/inventory')
  return { success: true }
}
