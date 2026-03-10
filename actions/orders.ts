'use server'

import { db } from '@/db'
import { orders, orderItems, inventory, products } from '@/db/schema'
import { requireAdminOrStaff, requireAuth } from '@/lib/auth/session'
import { eq, inArray } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { postGoogleChat } from '@/lib/google-chat/webhook'

export async function createOrder(formData: FormData) {
  const session = await requireAdminOrStaff()

  const customerId = formData.get('customerId') as string
  const orderType = formData.get('orderType') as 'paid' | 'sample'
  const notes = formData.get('notes') as string | null
  const itemsJson = formData.get('items') as string
  const items: { productId: string; quantity: number }[] = JSON.parse(itemsJson)

  // Fetch prices server-side — never trust client
  const productIds = items.map(i => i.productId)
  const productList = await db.select().from(products).where(inArray(products.id, productIds))
  const productMap = Object.fromEntries(productList.map(p => [p.id, p]))

  let subtotal = 0
  const lineItems = items.map(item => {
    const product = productMap[item.productId]
    const unitPrice = parseFloat(orderType === 'sample' ? product.samplePrice : product.price)
    const total = unitPrice * item.quantity
    subtotal += total
    return { productId: item.productId, quantity: String(item.quantity), unitPrice: unitPrice.toFixed(2), total: total.toFixed(2) }
  })

  const tax = 0 // Apply tax rules as needed
  const total = subtotal + tax

  const [order] = await db.insert(orders).values({
    customerId,
    createdBy: session.user.id,
    orderType,
    status: 'pending',
    subtotal: subtotal.toFixed(2),
    tax: tax.toFixed(2),
    total: total.toFixed(2),
    notes: notes || null,
  }).returning()

  await db.insert(orderItems).values(lineItems.map(li => ({ ...li, orderId: order.id })))

  // Decrement inventory
  for (const item of items) {
    const [inv] = await db.select().from(inventory).where(eq(inventory.productId, item.productId))
    if (inv) {
      const field = orderType === 'sample' ? 'quantitySample' : 'quantityPaid'
      await db.update(inventory)
        .set({ [field]: Math.max(0, (orderType === 'sample' ? inv.quantitySample : inv.quantityPaid) - item.quantity) })
        .where(eq(inventory.id, inv.id))
    }
  }

  // Notify Google Chat
  await postGoogleChat(`🛒 *New Order* created by ${session.user.name}\nCustomer ID: ${customerId}\nType: ${orderType.toUpperCase()}\nTotal: $${total.toFixed(2)}`)

  revalidatePath('/admin/invoicing')
  revalidatePath('/staff/orders')
  redirect(`/staff/orders/${order.id}`)
}

export async function updateOrderStatus(orderId: string, status: 'pending' | 'confirmed' | 'fulfilled' | 'cancelled') {
  await requireAdminOrStaff()
  await db.update(orders).set({ status }).where(eq(orders.id, orderId))
  revalidatePath('/admin/dashboard')
  revalidatePath('/staff/orders')
}
