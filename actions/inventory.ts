'use server'

import { db } from '@/db'
import { products, inventory } from '@/db/schema'
import { requireAdmin, requireAdminOrStaff } from '@/lib/auth/session'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { sendSampleCaseAlert } from '@/lib/resend/client'
import { auth } from '@/lib/auth/config'
import { logInventoryTransaction } from '@/lib/inventory/history'

export async function createProduct(formData: FormData) {
  await requireAdmin()

  const [product] = await db.insert(products).values({
    sku: formData.get('sku') as string,
    name: formData.get('name') as string,
    description: formData.get('description') as string || null,
    category: formData.get('category') as string || null,
    brand: formData.get('brand') as string || null,
    price: formData.get('price') as string,
    samplePrice: formData.get('samplePrice') as string || '0',
    bottlePrice: formData.get('bottlePrice') as string || '0',
    bottlesPerCase: parseInt(formData.get('bottlesPerCase') as string) || 12,
    unit: 'case',
    active: true,
  }).returning()

  await db.insert(inventory).values({
    productId: product.id,
    quantityPaid: parseInt(formData.get('quantityPaid') as string) || 0,
    quantitySample: parseInt(formData.get('quantitySample') as string) || 0,
    reorderLevel: parseInt(formData.get('reorderLevel') as string) || 10,
  })

  await logInventoryTransaction({
    productId: product.id,
    actorUserId: (await auth())?.user?.id ?? null,
    type: 'product_created',
    reason: 'Product created and added to inventory',
    deltaPaid: parseInt(formData.get('quantityPaid') as string) || 0,
    deltaSample: parseInt(formData.get('quantitySample') as string) || 0,
    quantityPaidAfter: parseInt(formData.get('quantityPaid') as string) || 0,
    quantitySampleAfter: parseInt(formData.get('quantitySample') as string) || 0,
    looseBottlePaidAfter: 0,
  })

  revalidatePath('/admin/inventory')
  redirect('/admin/inventory')
}

export async function adjustSampleCases(productId: string, delta: number): Promise<{ error?: string }> {
  await requireAdminOrStaff()

  const session = await auth()
  const staffName = session?.user?.name ?? 'Staff'

  const [row] = await db
    .select({
      quantityPaid: inventory.quantityPaid,
      quantitySample: inventory.quantitySample,
      looseBottlePaid: inventory.looseBottlePaid,
      name: products.name,
      sku: products.sku,
    })
    .from(inventory)
    .innerJoin(products, eq(inventory.productId, products.id))
    .where(eq(inventory.productId, productId))

  if (!row) return { error: 'Product not found' }

  const previousQty = row.quantitySample ?? 0
  const newQty = Math.max(0, previousQty + delta)

  await db.update(inventory)
    .set({ quantitySample: newQty, updatedAt: new Date() })
    .where(eq(inventory.productId, productId))

  await logInventoryTransaction({
    productId,
    actorUserId: session?.user?.id ?? null,
    type: 'sample_adjustment',
    reason: `Sample cases ${delta > 0 ? 'added' : 'removed'} by staff control`,
    deltaSample: newQty - previousQty,
    quantityPaidAfter: row.quantityPaid ?? 0,
    quantitySampleAfter: newQty,
    looseBottlePaidAfter: row.looseBottlePaid ?? 0,
  })

  revalidatePath('/staff/inventory')
  revalidatePath('/admin/inventory')

  // Fire-and-forget email — don't block UI
  sendSampleCaseAlert({
    staffName,
    productName: row.name,
    sku: row.sku,
    previousQty,
    newQty,
    delta: newQty - previousQty,
  })

  return {}
}

export async function adjustStock(formData: FormData) {
  await requireAdmin()

  const productId = formData.get('productId') as string
  const quantityPaid = parseInt(formData.get('quantityPaid') as string)
  const quantitySample = parseInt(formData.get('quantitySample') as string)
  const reorderLevel = parseInt(formData.get('reorderLevel') as string)
  const looseBottlePaid = parseInt(formData.get('looseBottlePaid') as string)
  const now = new Date()

  const [existingInventory] = await db
    .select({ productId: inventory.productId })
    .from(inventory)
    .where(eq(inventory.productId, productId))
    .limit(1)

  const nextQuantityPaid = Number.isNaN(quantityPaid) ? 0 : quantityPaid
  const nextQuantitySample = Number.isNaN(quantitySample) ? 0 : quantitySample
  const nextLooseBottlePaid = Number.isNaN(looseBottlePaid) ? 0 : looseBottlePaid

  if (existingInventory) {
    const [currentInventory] = await db
      .select()
      .from(inventory)
      .where(eq(inventory.productId, productId))
      .limit(1)

    await db.update(inventory)
      .set({
        quantityPaid,
        quantitySample,
        reorderLevel: Number.isNaN(reorderLevel) ? undefined : reorderLevel,
        looseBottlePaid: Number.isNaN(looseBottlePaid) ? undefined : looseBottlePaid,
        updatedAt: now,
      })
      .where(eq(inventory.productId, productId))

    await logInventoryTransaction({
      productId,
      actorUserId: (await auth())?.user?.id ?? null,
      type: 'manual_adjustment',
      reason: 'Inventory updated from admin inventory screen',
      deltaPaid: nextQuantityPaid - (currentInventory?.quantityPaid ?? 0),
      deltaSample: nextQuantitySample - (currentInventory?.quantitySample ?? 0),
      deltaLooseBottlePaid: nextLooseBottlePaid - (currentInventory?.looseBottlePaid ?? 0),
      quantityPaidAfter: nextQuantityPaid,
      quantitySampleAfter: nextQuantitySample,
      looseBottlePaidAfter: nextLooseBottlePaid,
    })
  } else {
    await db.insert(inventory).values({
      productId,
      quantityPaid: nextQuantityPaid,
      quantitySample: nextQuantitySample,
      reorderLevel: Number.isNaN(reorderLevel) ? 10 : reorderLevel,
      looseBottlePaid: nextLooseBottlePaid,
      updatedAt: now,
    })

    await logInventoryTransaction({
      productId,
      actorUserId: (await auth())?.user?.id ?? null,
      type: 'manual_adjustment',
      reason: 'Inventory record created from admin inventory screen',
      deltaPaid: nextQuantityPaid,
      deltaSample: nextQuantitySample,
      deltaLooseBottlePaid: nextLooseBottlePaid,
      quantityPaidAfter: nextQuantityPaid,
      quantitySampleAfter: nextQuantitySample,
      looseBottlePaidAfter: nextLooseBottlePaid,
    })
  }

  revalidatePath('/admin/inventory')
}
