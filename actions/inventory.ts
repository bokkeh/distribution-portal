'use server'

import { db } from '@/db'
import { products, inventory } from '@/db/schema'
import { requireAdmin } from '@/lib/auth/session'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

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

export async function adjustStock(formData: FormData) {
  await requireAdmin()

  const productId = formData.get('productId') as string
  const quantityPaid = parseInt(formData.get('quantityPaid') as string)
  const quantitySample = parseInt(formData.get('quantitySample') as string)

  await db.update(inventory)
    .set({ quantityPaid, quantitySample, updatedAt: new Date() })
    .where(eq(inventory.productId, productId))

  revalidatePath('/admin/inventory')
}
