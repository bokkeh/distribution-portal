'use server'

import { db } from '@/db'
import { customerAccounts, inventory, orderItems, orders, products, salesMembers } from '@/db/schema'
import { requireAuth } from '@/lib/auth/session'
import { eq, inArray } from 'drizzle-orm'
import { calculateCommissionForOrder, recordCommission } from '@/actions/sales-members'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { postGoogleChat } from '@/lib/google-chat/webhook'
import { logInventoryTransaction } from '@/lib/inventory/history'
import { getMinimumCaseQuantity, isWisherVodkaProduct } from '@/lib/orders/minimums'
import { createUserNotification } from '@/lib/notifications/in-app'
import { logActivityEvent } from '@/lib/activity/log'
import {
  sendNewOrderStaffNotification,
  sendOrderReceivedEmail,
  sendOrderShippingStatusEmail,
  sendOrderStatusEmail,
} from '@/lib/resend/client'
import { sendSms } from '@/lib/telnyx/client'

type PurchaseUnit = 'case' | 'bottle'

function uniqueEmails(...values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => value?.trim()).filter(Boolean) as string[]))
}

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
    const deliveryTiming = (formData.get('deliveryTiming') as string | null) ?? 'standard'
    const preferredDeliveryDay = (formData.get('preferredDeliveryDay') as string | null)?.trim() || null
    const preferredDeliveryTime = (formData.get('preferredDeliveryTime') as string | null)?.trim() || null
    const deliveryRequirements = (formData.get('deliveryRequirements') as string | null)?.trim() || null
    const paymentMethod = (formData.get('paymentMethod') as string | null) ?? null
    const processingFee = Number((formData.get('processingFee') as string | null) ?? '0')
    const itemsJson = formData.get('items') as string
    const items: { productId: string; quantity: number }[] = JSON.parse(itemsJson)

    let customerBusinessType: string | null = null
    if (userRoles.includes('customer')) {
      const [account] = await db
        .select({ id: customerAccounts.id, businessType: customerAccounts.businessType })
        .from(customerAccounts)
        .where(eq(customerAccounts.userId, session.user.id))
        .limit(1)

      if (!account || account.id !== customerId) {
        throw new Error('Unauthorized customer order')
      }
      customerBusinessType = account.businessType
    } else {
      const [account] = await db
        .select({ businessType: customerAccounts.businessType })
        .from(customerAccounts)
        .where(eq(customerAccounts.id, customerId))
        .limit(1)
      customerBusinessType = account?.businessType ?? null
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

    if (purchaseUnit === 'case' && isWisherVodkaProduct(product) && item.quantity < getMinimumCaseQuantity(product, customerBusinessType)) {
      throw new Error(`${product.name} requires a minimum order of ${getMinimumCaseQuantity(product, customerBusinessType)} cases`)
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
    const sanitizedProcessingFee = Number.isFinite(processingFee) && processingFee > 0 ? processingFee : 0
    const deliveryFee =
      deliveryTiming === 'time_sensitive'
        ? (preferredDeliveryDay && ['saturday', 'sunday'].includes(preferredDeliveryDay.toLowerCase()) ? 50 : 30)
        : 0
    const total = subtotal + tax + deliveryFee + sanitizedProcessingFee
    const deliverySummary = [
      `Delivery option: ${deliveryTiming === 'time_sensitive' ? 'Time-sensitive' : 'Standard within 2 weeks'}.`,
      preferredDeliveryDay ? `Requested day: ${preferredDeliveryDay}.` : null,
      preferredDeliveryTime ? `Requested time: ${preferredDeliveryTime}.` : null,
      deliveryTiming === 'time_sensitive' ? `Time-sensitive delivery fee: $${deliveryFee.toFixed(2)}.` : null,
      deliveryRequirements ? `Delivery requirements: ${deliveryRequirements}` : null,
    ].filter(Boolean).join('\n')
    const normalizedNotes = [
      notes?.trim() || null,
      deliverySummary,
      paymentMethod === 'card' && sanitizedProcessingFee > 0
        ? `Card processing fee paid by customer: $${sanitizedProcessingFee.toFixed(2)}.`
        : null,
    ].filter(Boolean).join('\n')

    const [order] = await db.insert(orders).values({
      customerId,
      createdBy: session.user.id,
      orderType: 'paid',
      status: 'pending',
      shippingStatus: 'not_scheduled',
      subtotal: subtotal.toFixed(2),
      tax: tax.toFixed(2),
      total: total.toFixed(2),
      notes: normalizedNotes || null,
    }).returning()

    await db.insert(orderItems).values(lineItems.map(item => ({ ...item, orderId: order.id })))

    // Auto-attribute order to assigned sales rep
    const [acct] = await db
      .select({ assignedSalesRepId: customerAccounts.assignedSalesRepId })
      .from(customerAccounts)
      .where(eq(customerAccounts.id, customerId))
      .limit(1)
    if (acct?.assignedSalesRepId) {
      await db
        .update(orders)
        .set({ attributedSalesMemberId: acct.assignedSalesRepId, attributionSource: 'auto_assigned' })
        .where(eq(orders.id, order.id))
      const { amount } = await calculateCommissionForOrder(order.id)
      if (amount !== null && amount > 0) {
        await recordCommission({ salesMemberId: acct.assignedSalesRepId, orderId: order.id, amount })
      }
    }

    await logActivityEvent({
      entityType: 'order',
      entityId: order.id,
      actorUserId: session.user.id,
      kind: 'order_created',
      title: 'Order created',
      body: `A ${purchaseUnit} order totaling $${total.toFixed(2)} was created.`,
    })

    const [customerAccount] = await db
      .select({
        userId: customerAccounts.userId,
        companyName: customerAccounts.companyName,
        email: customerAccounts.email,
        businessEmail: customerAccounts.businessEmail,
        pocEmail: customerAccounts.pocEmail,
      })
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

    const customerEmails = uniqueEmails(
      customerAccount?.pocEmail,
      customerAccount?.businessEmail,
      customerAccount?.email,
    )

    if (customerAccount?.companyName && customerEmails.length) {
      await sendOrderReceivedEmail({
        to: customerEmails,
        companyName: customerAccount.companyName,
        orderId: order.id,
        total: total.toFixed(2),
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

    // Staff order notifications — Kim and Kristen
    const smsBody = `New AHAWC order: ${customerAccount?.companyName ?? 'Unknown'} placed a ${purchaseUnit} order for $${total.toFixed(2)}. Order #${order.id.slice(-8).toUpperCase()}`
    const smsRecipients: string[] = [
      '+12489339350', // Kim
      process.env.ORDER_NOTIFY_KRISTEN_PHONE ?? '',
    ].filter(Boolean)

    await Promise.allSettled([
      ...smsRecipients.map(phone => sendSms({ to: phone, body: smsBody, bypassOptOut: true })),
      sendNewOrderStaffNotification({
        companyName: customerAccount?.companyName ?? 'Unknown account',
        orderId: order.id,
        total: total.toFixed(2),
        purchaseUnit,
        placedBy: session.user.name ?? 'A customer',
      }),
    ])

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
      email: customerAccounts.email,
      businessEmail: customerAccounts.businessEmail,
      pocEmail: customerAccounts.pocEmail,
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

  const customerEmails = uniqueEmails(order?.pocEmail, order?.businessEmail, order?.email)
  if (order?.companyName && customerEmails.length) {
    await sendOrderStatusEmail({
      to: customerEmails,
      companyName: order.companyName,
      orderId,
      status,
    })
  }

  revalidatePath('/admin/dashboard')
  revalidatePath('/admin/orders')
  revalidatePath('/staff/orders')
  revalidatePath(`/admin/orders/${orderId}`)
  revalidatePath(`/staff/orders/${orderId}`)
  revalidatePath(`/customer/orders/${orderId}`)
}

export async function bulkUpdateOrderStatus(input: {
  orderIds: string[]
  status: 'pending' | 'confirmed' | 'fulfilled' | 'cancelled'
}) {
  const session = await requireAuth()
  const userRoles = session.user.roles ?? [session.user.role as string]
  if (!userRoles.some(role => ['admin', 'staff'].includes(role))) {
    throw new Error('Unauthorized')
  }

  const orderIds = Array.from(new Set(input.orderIds.filter(Boolean)))
  if (!orderIds.length) return

  await db
    .update(orders)
    .set({ status: input.status })
    .where(inArray(orders.id, orderIds))

  for (const orderId of orderIds) {
    await logActivityEvent({
      entityType: 'order',
      entityId: orderId,
      actorUserId: session.user.id,
      kind: 'order_status_changed_bulk',
      title: 'Order status updated in bulk',
      body: `Status changed to ${input.status.replace(/_/g, ' ')}.`,
    })
  }

  revalidatePath('/admin/orders')
  revalidatePath('/staff/orders')
}

export async function reorderCustomerOrder(orderId: string) {
  const session = await requireAuth()
  const userRoles = session.user.roles ?? [session.user.role as string]
  if (!userRoles.includes('customer')) {
    throw new Error('Unauthorized')
  }

  const [account] = await db
    .select({ id: customerAccounts.id })
    .from(customerAccounts)
    .where(eq(customerAccounts.userId, session.user.id))
    .limit(1)

  if (!account) {
    throw new Error('Account not found')
  }

  const [existingOrder] = await db
    .select({
      id: orders.id,
      customerId: orders.customerId,
      orderType: orders.orderType,
      notes: orders.notes,
    })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1)

  if (!existingOrder || existingOrder.customerId !== account.id) {
    throw new Error('Order not found')
  }

  const existingItems = await db
    .select({
      productId: orderItems.productId,
      quantity: orderItems.quantity,
      unit: orderItems.unit,
      unitPrice: orderItems.unitPrice,
      total: orderItems.total,
    })
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId))

  if (!existingItems.length) {
    throw new Error('No order items found to reorder')
  }

  const subtotal = existingItems.reduce((sum, item) => sum + Number(item.total), 0)

  const [newOrder] = await db.insert(orders).values({
    customerId: account.id,
    createdBy: session.user.id,
    orderType: existingOrder.orderType,
    status: 'pending',
    shippingStatus: 'not_scheduled',
    subtotal: subtotal.toFixed(2),
    tax: '0.00',
    total: subtotal.toFixed(2),
    notes: existingOrder.notes,
  }).returning()

  await db.insert(orderItems).values(
    existingItems.map((item) => ({
      orderId: newOrder.id,
      productId: item.productId,
      quantity: item.quantity,
      unit: item.unit,
      unitPrice: item.unitPrice,
      total: item.total,
    }))
  )

  await logActivityEvent({
    entityType: 'order',
    entityId: newOrder.id,
    actorUserId: session.user.id,
    kind: 'order_reordered',
    title: 'Order reordered',
    body: `A repeat order was created from ${orderId.slice(-8).toUpperCase()}.`,
  })

  await createUserNotification({
    userId: session.user.id,
    kind: 'order_created',
    title: 'Reorder submitted',
    body: `Your repeat order has been submitted and is pending review.`,
    href: `/customer/orders/${newOrder.id}`,
  })

  revalidatePath('/customer/orders')
  redirect(`/customer/orders/${newOrder.id}?success=${encodeURIComponent('Your reorder has been submitted.')}`)
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
      email: customerAccounts.email,
      businessEmail: customerAccounts.businessEmail,
      pocEmail: customerAccounts.pocEmail,
      phone: customerAccounts.phone,
      notificationPreference: customerAccounts.notificationPreference,
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

  const customerEmails = uniqueEmails(order?.pocEmail, order?.businessEmail, order?.email)
  if (order?.companyName && customerEmails.length) {
    await sendOrderShippingStatusEmail({
      to: customerEmails,
      companyName: order.companyName,
      orderId,
      status: shippingStatus,
    })
  }

  // SMS notification — send for actionable statuses, respect preference
  const smsMessages: Partial<Record<typeof shippingStatus, string>> = {
    scheduled:        `AHAWC: Your order for ${order?.companyName ?? 'your account'} has been scheduled for delivery.`,
    out_for_delivery: `AHAWC: Your order for ${order?.companyName ?? 'your account'} is out for delivery today.`,
    delivered:        `AHAWC: Your order for ${order?.companyName ?? 'your account'} has been delivered. Thank you!`,
    issue:            `AHAWC: There is a delivery issue with your order for ${order?.companyName ?? 'your account'}. We will be in touch shortly.`,
  }
  const smsBody = smsMessages[shippingStatus]
  const prefersNoSms = order?.notificationPreference === 'email'
  if (smsBody && order?.phone && !prefersNoSms) {
    await sendSms({ to: order.phone, body: smsBody }).catch(() => {})
  }

  revalidatePath('/admin/orders')
  revalidatePath('/staff/orders')
  revalidatePath(`/admin/orders/${orderId}`)
  revalidatePath(`/staff/orders/${orderId}`)
  revalidatePath(`/customer/orders/${orderId}`)
}
