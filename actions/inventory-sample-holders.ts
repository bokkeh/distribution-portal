'use server'

import { db } from '@/db'
import { inventorySampleHolders } from '@/db/schema'
import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { requireAdminOrStaff } from '@/lib/auth/session'

export async function assignSamplesToUser(formData: FormData) {
  await requireAdminOrStaff()

  const productId = formData.get('productId') as string
  const userId = formData.get('userId') as string
  const quantity = parseInt(formData.get('quantity') as string, 10)
  const notes = (formData.get('notes') as string)?.trim() || null

  if (!productId || !userId || isNaN(quantity) || quantity < 1) {
    return { error: 'Product, user, and quantity are required.' }
  }

  // Check if this user already holds samples for this product — if so, add to quantity
  const [existing] = await db
    .select()
    .from(inventorySampleHolders)
    .where(
      and(
        eq(inventorySampleHolders.productId, productId),
        eq(inventorySampleHolders.userId, userId)
      )
    )

  if (existing) {
    await db
      .update(inventorySampleHolders)
      .set({ quantity: existing.quantity + quantity, notes: notes ?? existing.notes })
      .where(eq(inventorySampleHolders.id, existing.id))
  } else {
    await db.insert(inventorySampleHolders).values({ productId, userId, quantity, notes })
  }

  revalidatePath('/admin/inventory')
  return { success: true }
}

export async function returnSamplesFromUser(holderId: string) {
  await requireAdminOrStaff()
  await db.delete(inventorySampleHolders).where(eq(inventorySampleHolders.id, holderId))
  revalidatePath('/admin/inventory')
  return { success: true }
}

export async function updateSampleHolderQuantity(holderId: string, quantity: number) {
  await requireAdminOrStaff()

  if (quantity < 1) {
    await db.delete(inventorySampleHolders).where(eq(inventorySampleHolders.id, holderId))
  } else {
    await db
      .update(inventorySampleHolders)
      .set({ quantity })
      .where(eq(inventorySampleHolders.id, holderId))
  }

  revalidatePath('/admin/inventory')
  return { success: true }
}
