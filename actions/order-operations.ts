'use server'

import { db } from '@/db'
import { orders, drivers, users, customerAccounts } from '@/db/schema'
import { and, eq, sql } from 'drizzle-orm'
import { requireFeature } from '@/lib/auth/session'
import { operationInput, validatePaymentChange, validateFulfillmentTransition } from '@/lib/orders/operations'
import { syncOrderAccountInventory } from '@/lib/orders/account-inventory'
import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { notify } from '@/lib/notifications/dispatch'

export async function saveOrderOperations(input: unknown) {
  try {
    const session = await requireFeature('orders', 'admin', 'staff')
    const { orderId, expected, next } = operationInput.parse(input)
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1)
    if (!order) throw new Error('Order not found.')
    const current = { paymentStatus: order.paymentStatus, paymentMethod: order.paymentMethod, status: order.status, shippingStatus: order.shippingStatus, assignedDriverId: order.assignedDriverId }
    if (JSON.stringify(current) === JSON.stringify(next)) {
      await syncOrderAccountInventory(orderId, session.user.id)
      return { success: true as const, values: next }
    }
    validatePaymentChange(order, expected, next)
    validateFulfillmentTransition(expected.status, next.status)
    if (next.assignedDriverId && next.assignedDriverId !== current.assignedDriverId) {
      const [driver] = await db.select({ id: drivers.id }).from(drivers)
        .innerJoin(users, eq(users.id, drivers.userId))
        .where(and(eq(drivers.id, next.assignedDriverId), eq(drivers.active, true), eq(users.active, true))).limit(1)
      if (!driver) throw new Error('Choose an active driver.')
    }
    // The compare-and-set and audit insert are one atomic database statement.
    // Compare actual fields too: legacy forms and provider webhooks do not use the revision.
    const result = await db.execute(sql`
      WITH changed AS (
        UPDATE orders SET payment_status = ${next.paymentStatus}, payment_method = ${next.paymentMethod},
          status = ${next.status}, shipping_status = ${next.shippingStatus}, assigned_driver_id = ${next.assignedDriverId}::uuid,
          paid_at = CASE WHEN ${next.paymentStatus} = 'paid' THEN coalesce(paid_at, now()) ELSE NULL END,
          operations_revision = operations_revision + 1
        WHERE id = ${orderId}::uuid AND payment_status = ${expected.paymentStatus}
          AND payment_method IS NOT DISTINCT FROM ${expected.paymentMethod}::text
          AND status = ${expected.status} AND shipping_status = ${expected.shippingStatus}
          AND assigned_driver_id IS NOT DISTINCT FROM ${expected.assignedDriverId}::uuid
          AND stripe_payment_intent_id IS NOT DISTINCT FROM ${order.stripePaymentIntentId}::text
        RETURNING id
      ) INSERT INTO activity_events (entity_type, entity_id, actor_user_id, kind, title, metadata)
        SELECT 'order', id, ${session.user.id}::uuid, 'order_operations_saved', 'Order operations saved',
          ${JSON.stringify({ previous: expected, next })}::jsonb FROM changed RETURNING entity_id
    `)
    if (!result.rows.length) return { error: 'This order changed elsewhere. Review the current values before retrying.', conflict: true as const }
    if (expected.status !== next.status) after(async () => {
      try {
        const [account] = await db.select().from(customerAccounts).where(eq(customerAccounts.id, order.customerId)).limit(1)
        const customerEmails = [...new Set([account?.pocEmail, account?.businessEmail, account?.email].map(value => value?.trim()).filter((value): value is string => Boolean(value)))]
        await notify('order.status_changed', { companyName: account?.companyName ?? '', orderId, status: next.status, customerEmails, userId: account?.userId })
      } catch (error) { console.error('Order status notification failed', error) }
    })
    let warning: string | undefined
    try { await syncOrderAccountInventory(orderId, session.user.id) }
    catch { warning = 'Order saved; inventory synchronization needs retry.' }
    for (const path of ['/admin/orders', '/staff/orders', '/customer/orders', '/admin/dashboard', '/staff/dashboard', '/sales/dashboard', '/admin/reports', '/admin/invoicing', `/admin/orders/${orderId}`, `/staff/orders/${orderId}`, `/customer/orders/${orderId}`, `/admin/crm/${order.customerId}`, `/staff/crm/${order.customerId}`, `/sales/accounts/${order.customerId}`]) revalidatePath(path)
    return { success: true as const, values: next, warning }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Failed to save order.' }
  }
}
