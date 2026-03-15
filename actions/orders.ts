'use server'

import { db } from '@/db'
import { customerAccounts, inventory, orderItems, orders, products } from '@/db/schema'
import { requireAuth } from '@/lib/auth/session'
import { eq, inArray } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { postGoogleChat } from '@/lib/google-chat/webhook'
import { logInventoryTransaction } from '@/lib/inventory/history'
import { getMinimumCaseQuantity, isWisherVodkaProduct } from '@/lib/orders/minimums'
import { createUserNotification } from '@/lib/notifications/in-app'
import { logActivityEvent } from '@/lib/activity/log'

type PurchaseUnit = 'case' | 'bottle'

export async function createOrder(formData: FormData) {
  try {
    const session = await requireAuth()
    const userRoles = session.user.roles ?? [session.user.role as string]
    const canCreateOrder = userRoles.some(role => ['admin', 'staff', 'customer'].includes(role))
    if (!canCreateOrder) {
      throw new Error('Unauthorized')
    }

    const customerId = formData.get('customerId') as string
    const purchaseUnit = (formData.get('purchaseUnit') as PurchaseUnit) || 'case'
    const notes = formData.get('notes') as string | null
    const itemsJson = formData.get('items') as string
    const items: { productId: string; quantity: number }[] = JSON.parse(itemsJson)

    if (userRoles.includes('customer')) {
      const [account] = await db
        .select({ id: customerAccounts.id })
        .from(customerAccounts)
        .where(eq(customerAccounts.userId, session.user.id))
        .limit(1)

      if (!account || account.id !== customerId) {
        throw new Error('Unauthorized customer order')
      }
    }

    const productIds = items.map(item => item.productId)
    const [productList, inventoryRows] = await Promise.all([
      db.select().from(products).where(inArray(products.id, productIds)),
      db.select().from(inventory).where(inArray(inventory.productId, productIds)),
    ])

    const productMap = Object.fromEntries(productList.map(product => [product.id, product]))
    const inventoryMap = Object.fromEntries(inventoryRows.map(row => [row.productId, row]))

    let subtotal = 0

    const lineItems = items.map(item => {
    const product = productMap[item.productId]
    const inv = inventoryMap[item.productId]
    if (!product) {
      throw new Error(`Product ${item.productId} not found`)
    }
    if (!inv) {
      throw new Error(`Inventory record missing for product ${product.name}`)
    }

    const bottlesPerCase = product.bottlesPerCase || 12
    const availableQuantity = purchaseUnit === 'bottle'
      ? inv.quantityPaid * bottlesPerCase - inv.looseBottlePaid
      : inv.quantityPaid

    if (item.quantity > availableQuantity) {
      throw new Error(`Not enough ${purchaseUnit}s in stock for ${product.name}`)
    }

    if (purchaseUnit === 'case' && isWisherVodkaProduct(product) && item.quantity < getMinimumCaseQuantity(product)) {
      throw new Error(`${product.name} requires a minimum order of ${getMinimumCaseQuantity(product)} cases`)
    }

    const unitPrice = purchaseUnit === 'bottle'
      ? parseFloat(product.bottlePrice || '0') || (parseFloat(product.price) / bottlesPerCase)
      : parseFloat(product.price)

    const total = unitPrice * item.quantity
    subtotal += total

    return {
      orderId: '',
      productId: item.productId,
      quantity: String(item.quantity),
      unit: purchaseUnit,
      unitPrice: unitPrice.toFixed(2),
      total: total.toFixed(2),
    }
    })

    const tax = 0
    const total = subtotal + tax

    const [order] = await db.insert(orders).values({
      customerId,
      createdBy: session.user.id,
      orderType: 'paid',
      status: 'pending',
      shippingStatus: 'not_scheduled',
      subtotal: subtotal.toFixed(2),
      tax: tax.toFixed(2),
      total: total.toFixed(2),
      notes: notes || null,
    }).returning()

    await db.insert(orderItems).values(lineItems.map(item => ({ ...item, orderId: order.id })))

    await logActivityEvent({
      entityType: 'order',
      entityId: order.id,
      actorUserId: session.user.id,
      kind: 'order_created',
      title: 'Order created',
      body: `A ${purchaseUnit} order totaling $${total.toFixed(2)} was created.`,
    })

    const [customerAccount] = await db
      .select({ userId: customerAccounts.userId, companyName: customerAccounts.companyName })
      .from(customerAccounts)
      .where(eq(customerAccounts.id, customerId))
      .limit(1)

    if (customerAccount?.userId) {
      await createUserNotification({
        userId: customerAccount.userId,
        kind: 'order_created',
        title: 'Order received',
        body: `Your order for ${customerAccount.companyName} has been received and is now being processed.`,
        href: `/customer/orders/${order.id}`,
      })
    }

    for (const item of items) {
    const product = productMap[item.productId]
    const inv = inventoryMap[item.productId]

    if (!product || !inv) continue

    if (purchaseUnit === 'case') {
      const nextQuantityPaid = Math.max(0, inv.quantityPaid - item.quantity)
      await db.update(inventory)
        .set({ quantityPaid: nextQuantityPaid })
        .where(eq(inventory.id, inv.id))

      await logInventoryTransaction({
        productId: item.productId,
        actorUserId: session.user.id,
        orderId: order.id,
        type: 'order_allocation',
        reason: `Allocated ${item.quantity} case(s) to order ${order.id.slice(-8).toUpperCase()}`,
        deltaPaid: -item.quantity,
        quantityPaidAfter: nextQuantityPaid,
        quantitySampleAfter: inv.quantitySample,
        looseBottlePaidAfter: inv.looseBottlePaid,
      })
      continue
    }

    const bottlesPerCase = product.bottlesPerCase || 12
    const totalLoose = inv.looseBottlePaid + item.quantity
    const consumedCases = Math.floor(totalLoose / bottlesPerCase)
    const nextLooseBottlePaid = totalLoose % bottlesPerCase
    const nextQuantityPaid = Math.max(0, inv.quantityPaid - consumedCases)

    await db.update(inventory)
      .set({
        quantityPaid: nextQuantityPaid,
        looseBottlePaid: nextLooseBottlePaid,
      })
      .where(eq(inventory.id, inv.id))

    await logInventoryTransaction({
      productId: item.productId,
      actorUserId: session.user.id,
      orderId: order.id,
      type: 'order_allocation',
      reason: `Allocated ${item.quantity} bottle(s) to order ${order.id.slice(-8).toUpperCase()}`,
      deltaPaid: -(consumedCases || 0),
      deltaLooseBottlePaid: nextLooseBottlePaid - inv.looseBottlePaid,
      quantityPaidAfter: nextQuantityPaid,
      quantitySampleAfter: inv.quantitySample,
      looseBottlePaidAfter: nextLooseBottlePaid,
    })
    }

    await postGoogleChat(
      `New Order created by ${session.user.name}\nCustomer ID: ${customerId}\nUnit: ${purchaseUnit.toUpperCase()}\nTotal: $${total.toFixed(2)}`
    )

    revalidatePath('/admin/invoicing')
    revalidatePath('/staff/orders')
    revalidatePath('/customer/orders')

    return {
      success: true as const,
      redirectTo: userRoles.includes('customer') ? `/customer/orders/${order.id}` : `/staff/orders/${order.id}`,
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Failed to create order' }
  }
}

export async function updateOrderStatus(orderId: string, status: 'pending' | 'confirmed' | 'fulfilled' | 'cancelled') {
  const session = await requireAuth()
  const userRoles = session.user.roles ?? [session.user.role as string]
  if (!userRoles.some(role => ['admin', 'staff'].includes(role))) {
    throw new Error('Unauthorized')
  }
  await db.update(orders).set({ status }).where(eq(orders.id, orderId))
  await logActivityEvent({
    entityType: 'order',
    entityId: orderId,
    actorUserId: session.user.id,
    kind: 'order_status_changed',
    title: 'Order status changed',
    body: `Status changed to ${status.replace(/_/g, ' ')}.`,
  })

  const [order] = await db
    .select({
      id: orders.id,
      customerUserId: customerAccounts.userId,
      companyName: customerAccounts.companyName,
    })
    .from(orders)
    .leftJoin(customerAccounts, eq(orders.customerId, customerAccounts.id))
    .where(eq(orders.id, orderId))
    .limit(1)

  if (order?.customerUserId) {
    const details = {
      pending: {
        title: 'Order update',
        body: `Your order for ${order.companyName ?? 'your account'} is pending review.`,
      },
      confirmed: {
        title: 'Order processed',
        body: `Your order for ${order.companyName ?? 'your account'} has been processed and confirmed.`,
      },
      fulfilled: {
        title: 'Order complete',
        body: `Your order for ${order.companyName ?? 'your account'} has been completed.`,
      },
      cancelled: {
        title: 'Order cancelled',
        body: `Your order for ${order.companyName ?? 'your account'} has been cancelled.`,
      },
    }[status]

    await createUserNotification({
      userId: order.customerUserId,
      kind: 'order_status',
      title: details.title,
      body: details.body,
      href: `/customer/orders/${orderId}`,
    })
  }
  revalidatePath('/admin/dashboard')
  revalidatePath('/admin/orders')
  revalidatePath('/staff/orders')
  revalidatePath(`/admin/orders/${orderId}`)
  revalidatePath(`/staff/orders/${orderId}`)
  revalidatePath(`/customer/orders/${orderId}`)
}

export async function updateOrderShippingStatus(orderId: string, formData: FormData) {
  const session = await requireAuth()
  const userRoles = session.user.roles ?? [session.user.role as string]
  if (!userRoles.some(role => ['admin', 'staff'].includes(role))) {
    throw new Error('Unauthorized')
  }

  const shippingStatus = formData.get('shippingStatus') as 'not_scheduled' | 'scheduled' | 'out_for_delivery' | 'delivered' | 'issue'

  await db.update(orders).set({ shippingStatus }).where(eq(orders.id, orderId))
  await logActivityEvent({
    entityType: 'order',
    entityId: orderId,
    actorUserId: session.user.id,
    kind: 'shipping_status_changed',
    title: 'Shipping status updated',
    body: `Shipping changed to ${shippingStatus.replace(/_/g, ' ')}.`,
  })

  const [order] = await db
    .select({
      customerUserId: customerAccounts.userId,
      companyName: customerAccounts.companyName,
    })
    .from(orders)
    .leftJoin(customerAccounts, eq(orders.customerId, customerAccounts.id))
    .where(eq(orders.id, orderId))
    .limit(1)

  if (order?.customerUserId) {
    const details = {
      not_scheduled: {
        title: 'Shipping update',
        body: `Your order for ${order.companyName ?? 'your account'} is awaiting delivery scheduling.`,
      },
      scheduled: {
        title: 'Delivery scheduled',
        body: `Your order for ${order.companyName ?? 'your account'} has been scheduled for delivery.`,
      },
      out_for_delivery: {
        title: 'Order out for delivery',
        body: `Your order for ${order.companyName ?? 'your account'} is currently being delivered.`,
      },
      delivered: {
        title: 'Order delivered',
        body: `Your order for ${order.companyName ?? 'your account'} has been delivered.`,
      },
      issue: {
        title: 'Delivery issue',
        body: `There is a delivery issue with your order for ${order.companyName ?? 'your account'}.`,
      },
    }[shippingStatus]

    await createUserNotification({
      userId: order.customerUserId,
      kind: 'shipping_status',
      title: details.title,
      body: details.body,
      href: `/customer/orders/${orderId}`,
    })
  }
  revalidatePath('/admin/orders')
  revalidatePath('/staff/orders')
  revalidatePath(`/admin/orders/${orderId}`)
  revalidatePath(`/staff/orders/${orderId}`)
  revalidatePath(`/customer/orders/${orderId}`)
}
