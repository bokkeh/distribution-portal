'use server'

import { db } from '@/db'
import { products, inventory } from '@/db/schema'
import { requireAdmin, requireAdminOrStaff } from '@/lib/auth/session'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { sendSampleCaseAlert } from '@/lib/resend/client'
import { auth } from '@/lib/auth/config'

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

  revalidatePath('/admin/inventory')
  redirect('/admin/inventory')
}

export async function adjustSampleCases(productId: string, delta: number): Promise<{ error?: string }> {
  await requireAdminOrStaff()

  const session = await auth()
  const staffName = session?.user?.name ?? 'Staff'

  const [row] = await db
    .select({ quantitySample: inventory.quantitySample, name: products.name, sku: products.sku })
    .from(inventory)
    .innerJoin(products, eq(inventory.productId, products.id))
    .where(eq(inventory.productId, productId))

  if (!row) return { error: 'Product not found' }

  const previousQty = row.quantitySample ?? 0
  const newQty = Math.max(0, previousQty + delta)

  await db.update(inventory)
    .set({ quantitySample: newQty, updatedAt: new Date() })
    .where(eq(inventory.productId, productId))

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

  if (existingInventory) {
    await db.update(inventory)
      .set({
        quantityPaid,
        quantitySample,
        reorderLevel: Number.isNaN(reorderLevel) ? undefined : reorderLevel,
        looseBottlePaid: Number.isNaN(looseBottlePaid) ? undefined : looseBottlePaid,
        updatedAt: now,
      })
      .where(eq(inventory.productId, productId))
  } else {
    await db.insert(inventory).values({
      productId,
      quantityPaid: Number.isNaN(quantityPaid) ? 0 : quantityPaid,
      quantitySample: Number.isNaN(quantitySample) ? 0 : quantitySample,
      reorderLevel: Number.isNaN(reorderLevel) ? 10 : reorderLevel,
      looseBottlePaid: Number.isNaN(looseBottlePaid) ? 0 : looseBottlePaid,
      updatedAt: now,
    })
  }

  revalidatePath('/admin/inventory')
}
