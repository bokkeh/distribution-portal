'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { orders } from '@/db/schema'
import { requireFeature } from '@/lib/auth/session'
import { logActivityEvent } from '@/lib/activity/log'
import { isValidDateOnly } from '@/lib/orders/delivery-date'

export async function updateOrderDeliveryDate(orderId: string, deliveryDate: string) {
  const session = await requireFeature('orders', 'admin', 'staff')
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId)) return { error: 'Invalid order.' }
  if (deliveryDate && !isValidDateOnly(deliveryDate)) return { error: 'Enter a valid delivery date.' }
  const [order] = await db.update(orders).set({ deliveryDate: deliveryDate || null })
    .where(eq(orders.id, orderId)).returning({ id: orders.id })
  if (!order) return { error: 'Order not found.' }
  await logActivityEvent({ entityType: 'order', entityId: orderId, actorUserId: session.user.id,
    kind: 'order_delivery_date_updated', title: 'Delivery date updated', body: deliveryDate || 'Delivery date cleared.' })
  revalidatePath(`/admin/orders/${orderId}`)
  revalidatePath(`/staff/orders/${orderId}`)
  return { success: true as const }
}
