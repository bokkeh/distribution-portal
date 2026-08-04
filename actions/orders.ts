'use server'

import Stripe from 'stripe'
import { db } from '@/db'
import { customerAccounts, inventory, orderItems, orders, salesMembers } from '@/db/schema'
import { getEffectiveSession, requireAuth, requireRole } from '@/lib/auth/session'
import { eq, inArray } from 'drizzle-orm'
import { calculateCommissionForOrder, recordCommission } from '@/actions/sales-members'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { logInventoryTransaction } from '@/lib/inventory/history'
import { createUserNotification } from '@/lib/notifications/in-app'
import { notify } from '@/lib/notifications/dispatch'
import { logActivityEvent } from '@/lib/activity/log'
import { formatPaymentTerms } from '@/lib/orders/payment-terms'
import { buildPricedLineItems, computeDeliveryFee, type CheckoutOrderType, type PurchaseUnit } from '@/lib/orders/checkout'
import type { OrderPaymentStatus } from '@/db/schema'
import { formatDate } from '@/lib/utils'

function uniqueEmails(...values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => value?.trim()).filter(Boolean) as string[]))
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? 'sk_test_missing_configuration', { apiVersion: '2026-02-25.clover' })

function resolveOrderPaymentStatus(status: Stripe.PaymentIntent.Status): OrderPaymentStatus {
  switch (status) {
    case 'succeeded':
      return 'paid'
    case 'processing':
    case 'requires_capture':
      return 'processing'
    case 'canceled':
      return 'canceled'
    case 'requires_payment_method':
      return 'failed'
    default:
      return 'requires_action'
  }
}

function revalidateOrderDatePaths(orderId: string, customerId: string) {
  revalidatePath('/admin/dashboard')
  revalidatePath('/staff/dashboard')
  revalidatePath('/sales/dashboard')
  revalidatePath('/sales/forecast')
  revalidatePath('/customer/dashboard')
  revalidatePath('/admin/orders')
  revalidatePath(`/admin/orders/${orderId}`)
  revalidatePath('/staff/orders')
  revalidatePath(`/staff/orders/${orderId}`)
  revalidatePath('/customer/orders')
  revalidatePath(`/customer/orders/${orderId}`)
  revalidatePath('/admin/crm')
  revalidatePath(`/admin/crm/${customerId}`)
  revalidatePath('/staff/crm')
  revalidatePath(`/staff/crm/${customerId}`)
  revalidatePath('/sales/accounts')
  revalidatePath(`/sales/accounts/${customerId}`)
}

function parsePlacedDateInput(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!match) {
    throw new Error('Choose a valid order date.')
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const parsed = new Date(Date.UTC(year, month - 1, day, 12, 0, 0))

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new Error('Choose a valid order date.')
  }

  return parsed
}

export async function updateOrderPlacedDate(input: { orderId: string; placedDate: string }) {
  try {
    const session = await requireRole('admin', 'staff', 'sales_rep', 'sales_manager')
    const userRoles = session.user.roles ?? [session.user.role as string]
    const canManageAny = userRoles.some((role) => ['admin', 'staff', 'sales_manager'].includes(role))

    const [order] = await db
      .select({
        id: orders.id,
        customerId: orders.customerId,
        createdAt: orders.createdAt,
        assignedSalesRepId: customerAccounts.assignedSalesRepId,
      })
      .from(orders)
      .innerJoin(customerAccounts, eq(orders.customerId, customerAccounts.id))
      .where(eq(orders.id, input.orderId))
      .limit(1)

    if (!order) {
      throw new Error('Order not found.')
    }

    if (!canManageAny) {
      const [member] = await db
        .select({ id: salesMembers.id })
        .from(salesMembers)
        .where(eq(salesMembers.userId, session.user.id))
        .limit(1)

      if (!member || order.assignedSalesRepId !== member.id) {
        throw new Error('Unauthorized sales order')
      }
    }

    const nextCreatedAt = parsePlacedDateInput(input.placedDate)
    const previousDateValue = order.createdAt.toISOString().slice(0, 10)

    if (previousDateValue === input.placedDate.trim()) {
      return { success: true as const, createdAt: order.createdAt.toISOString() }
    }

    await db
      .update(orders)
      .set({ createdAt: nextCreatedAt })
      .where(eq(orders.id, order.id))

    await logActivityEvent({
      entityType: 'order',
      entityId: order.id,
      actorUserId: session.user.id,
      kind: 'order_placed_date_updated',
      title: 'Order placed date updated',
      body: `Placed date changed from ${formatDate(order.createdAt)} to ${formatDate(nextCreatedAt)}.`,
      metadata: {
        previousCreatedAt: order.createdAt.toISOString(),
        nextCreatedAt: nextCreatedAt.toISOString(),
      },
    })

    revalidateOrderDatePaths(order.id, order.customerId)

    return {
      success: true as const,
      createdAt: nextCreatedAt.toISOString(),
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Failed to update order date' }
  }
}

export async function createOrder(formData: FormData) {
  try {
    const session = await getEffectiveSession()
    if (!session) {
      throw new Error('Unauthorized')
    }
    const userRoles = session.user.roles ?? [session.user.role as string]
    const canCreateOrder = userRoles.some(role => ['admin', 'staff', 'customer', 'sales_rep', 'sales_manager'].includes(role))
    if (!canCreateOrder) {
      throw new Error('Unauthorized')
    }
    const isSalesRepOnly = userRoles.includes('sales_rep') && !userRoles.some((role) => ['admin', 'staff', 'sales_manager'].includes(role))
    const isCustomerOrder = userRoles.includes('customer') && !userRoles.some((role) => ['admin', 'staff', 'sales_rep', 'sales_manager'].includes(role))

    const customerId = formData.get('customerId') as string
    const purchaseUnit = (formData.get('purchaseUnit') as PurchaseUnit) || 'case'
    const orderType = (formData.get('orderType') as CheckoutOrderType) === 'sample' ? 'sample' : 'paid'
    const notes = formData.get('notes') as string | null
    const deliveryTiming = (formData.get('deliveryTiming') as string | null) ?? 'standard'
    const preferredDeliveryDay = (formData.get('preferredDeliveryDay') as string | null)?.trim() || null
    const preferredDeliveryTime = (formData.get('preferredDeliveryTime') as string | null)?.trim() || null
    const deliveryRequirements = (formData.get('deliveryRequirements') as string | null)?.trim() || null
    const requestedPaymentTerms = (formData.get('paymentTerms') as string | null)?.trim() || null
    const orderedDateInput = (formData.get('orderedDate') as string | null)?.trim() || null
    const paymentMethod = (formData.get('paymentMethod') as string | null) ?? null
    const processingFee = Number((formData.get('processingFee') as string | null) ?? '0')
    const paymentIntentId = (formData.get('paymentIntentId') as string | null)?.trim() || null
    const itemsJson = formData.get('items') as string
    const items: { productId: string; quantity: number }[] = JSON.parse(itemsJson)
    const orderDate = !isCustomerOrder && orderedDateInput ? parsePlacedDateInput(orderedDateInput) : new Date()

    let customerBusinessType: string | null = null
    let defaultPaymentTerms = 'PREPAID'
    if (isCustomerOrder) {
      const [account] = await db
        .select({
          id: customerAccounts.id,
          businessType: customerAccounts.businessType,
          paymentTerms: customerAccounts.paymentTerms,
        })
        .from(customerAccounts)
        .where(eq(customerAccounts.userId, session.user.id))
        .limit(1)

      if (!account || account.id !== customerId) {
        throw new Error('Unauthorized customer order')
      }
      customerBusinessType = account.businessType
      defaultPaymentTerms = account.paymentTerms ?? 'PREPAID'
    } else {
      const [account] = await db
        .select({
          id: customerAccounts.id,
          businessType: customerAccounts.businessType,
          paymentTerms: customerAccounts.paymentTerms,
          assignedSalesRepId: customerAccounts.assignedSalesRepId,
        })
        .from(customerAccounts)
        .where(eq(customerAccounts.id, customerId))
        .limit(1)

      if (isSalesRepOnly) {
        const [member] = await db
          .select({ id: salesMembers.id })
          .from(salesMembers)
          .where(eq(salesMembers.userId, session.user.id))
          .limit(1)

        if (!member) {
          throw new Error('No sales member profile found.')
        }

        if (!account || account.assignedSalesRepId !== member.id) {
          throw new Error('Unauthorized sales order')
        }
      }

      customerBusinessType = account?.businessType ?? null
      defaultPaymentTerms = account?.paymentTerms ?? 'PREPAID'
    }

    const paymentTerms = isCustomerOrder
      ? defaultPaymentTerms
      : (requestedPaymentTerms || defaultPaymentTerms)

    const { lineItems, subtotal, productMap, inventoryMap } = await buildPricedLineItems({
      customerId,
      purchaseUnit,
      orderDate,
      orderType,
      items,
      customerBusinessType,
    })

    const tax = 0
    const sanitizedProcessingFee = Number.isFinite(processingFee) && processingFee > 0 ? processingFee : 0
    const deliveryFee = computeDeliveryFee(deliveryTiming, preferredDeliveryDay)
    const total = subtotal + tax + deliveryFee + sanitizedProcessingFee
    let paymentStatus: OrderPaymentStatus = 'not_applicable'
    let paidAt: Date | null = null

    if (isCustomerOrder) {
      if (!paymentIntentId) {
        throw new Error('Missing payment confirmation. Please restart checkout.')
      }

      const [existingOrder] = await db
        .select({ id: orders.id })
        .from(orders)
        .where(eq(orders.stripePaymentIntentId, paymentIntentId))
        .limit(1)

      if (existingOrder) {
        throw new Error('This payment has already been used for an order.')
      }

      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)
      const expectedAmountCents = Math.round(total * 100)
      const nextPaymentStatus = resolveOrderPaymentStatus(paymentIntent.status)

      if (paymentIntent.metadata?.customerId !== customerId || paymentIntent.metadata?.checkoutScope !== 'customer_order') {
        throw new Error('Payment confirmation does not match this account.')
      }

      if ((paymentIntent.metadata?.orderType ?? 'paid') !== orderType) {
        throw new Error('Payment confirmation does not match the selected order type.')
      }

      if (paymentIntent.amount !== expectedAmountCents) {
        throw new Error('Payment confirmation amount does not match this order. Please restart checkout.')
      }

      if (nextPaymentStatus === 'failed' || nextPaymentStatus === 'canceled') {
        throw new Error('Payment was not completed. Please try again.')
      }

      if (nextPaymentStatus === 'requires_action') {
        throw new Error('Stripe still requires additional payment confirmation. Please finish the payment step and retry.')
      }

      paymentStatus = nextPaymentStatus
      paidAt = paymentStatus === 'paid' ? new Date() : null
    }

    const deliverySummary = [
      `Delivery option: ${deliveryTiming === 'time_sensitive' ? 'Time-sensitive' : 'Standard within 2 weeks'}.`,
      preferredDeliveryDay ? `Requested day: ${preferredDeliveryDay}.` : null,
      preferredDeliveryTime ? `Requested time: ${preferredDeliveryTime}.` : null,
      deliveryTiming === 'time_sensitive' ? `Time-sensitive delivery fee: $${deliveryFee.toFixed(2)}.` : null,
      deliveryRequirements ? `Delivery requirements: ${deliveryRequirements}` : null,
    ].filter(Boolean).join('\n')
    const normalizedNotes = [
      notes?.trim() || null,
      `Payment terms: ${formatPaymentTerms(paymentTerms)}.`,
      deliverySummary,
      sanitizedProcessingFee > 0
        ? `Stripe ${paymentMethod === 'card' ? 'card' : 'ACH'} processing fee paid by customer: $${sanitizedProcessingFee.toFixed(2)}.`
        : null,
      isCustomerOrder && paymentStatus === 'processing'
        ? 'Payment status: awaiting Stripe confirmation before funds settle.'
        : null,
    ].filter(Boolean).join('\n')

    const [order] = await db.insert(orders).values({
      customerId,
      createdBy: session.user.id,
      createdAt: orderDate,
      orderType,
      paymentTerms,
      stripePaymentIntentId: paymentIntentId,
      paymentStatus,
      paidAt,
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
        title: paymentStatus === 'processing' ? 'Order received, payment processing' : 'Order received',
        body: paymentStatus === 'processing'
          ? `Your order for ${customerAccount.companyName} was received. We are waiting for Stripe to confirm the payment.`
          : `Your order for ${customerAccount.companyName} has been received and is now being processed.`,
        href: `/customer/orders/${order.id}`,
      })
    }


    for (const item of items) {
    const product = productMap.get(item.productId)
    const inv = inventoryMap.get(item.productId)

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

    await notify('order.received', {
      companyName: customerAccount?.companyName ?? 'Unknown account',
      orderId: order.id,
      total: total.toFixed(2),
      purchaseUnit,
      placedBy: session.user.name ?? 'A customer',
      customerEmails: uniqueEmails(customerAccount?.pocEmail, customerAccount?.businessEmail, customerAccount?.email),
      staffPhones: [process.env.STAFF_NOTIFICATION_PHONE_2, process.env.ORDER_NOTIFY_KRISTEN_PHONE].filter(Boolean) as string[],
      userId: session.user.id,
    })

    revalidatePath('/admin/invoicing')
    revalidatePath('/staff/orders')
    revalidatePath('/customer/orders')
    revalidatePath('/sales/accounts')
    revalidatePath(`/sales/accounts/${customerId}`)

    return {
      success: true as const,
      paymentStatus,
      redirectTo: isCustomerOrder
        ? `/customer/orders/${order.id}`
        : userRoles.includes('admin')
          ? `/admin/orders/${order.id}`
          : userRoles.some((role) => ['sales_rep', 'sales_manager'].includes(role))
            ? `/sales/accounts/${customerId}?tab=orders`
            : `/staff/orders/${order.id}`,
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Failed to create order' }
  }
}

export async function applyWebhookOrderPaymentUpdate(
  paymentIntentId: string,
  paymentIntentStatus: Stripe.PaymentIntent.Status,
  actorUserId: string,
) {
  const nextPaymentStatus = resolveOrderPaymentStatus(paymentIntentStatus)
  if (nextPaymentStatus === 'requires_action') return

  const [order] = await db
    .select({
      id: orders.id,
      customerId: orders.customerId,
      paymentStatus: orders.paymentStatus,
    })
    .from(orders)
    .where(eq(orders.stripePaymentIntentId, paymentIntentId))
    .limit(1)

  if (!order || order.paymentStatus === nextPaymentStatus) return

  await db
    .update(orders)
    .set({
      paymentStatus: nextPaymentStatus,
      paidAt: nextPaymentStatus === 'paid' ? new Date() : null,
    })
    .where(eq(orders.id, order.id))

  const activityBody =
    nextPaymentStatus === 'paid'
      ? 'Stripe confirmed payment for this order.'
      : nextPaymentStatus === 'processing'
        ? 'Stripe marked payment as processing.'
        : nextPaymentStatus === 'failed'
          ? 'Stripe reported a failed payment for this order.'
          : 'Stripe canceled the payment for this order.'

  await logActivityEvent({
    entityType: 'order',
    entityId: order.id,
    actorUserId,
    kind: 'order_payment_status_changed',
    title: 'Order payment status updated',
    body: activityBody,
    metadata: { paymentIntentId, paymentStatus: nextPaymentStatus },
  })

  revalidatePath('/customer/orders')
  revalidatePath(`/customer/orders/${order.id}`)
  revalidatePath('/admin/orders')
  revalidatePath(`/admin/orders/${order.id}`)
  revalidatePath('/staff/orders')
  revalidatePath(`/staff/orders/${order.id}`)
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

  await notify('order.status_changed', {
    companyName: order?.companyName ?? '',
    orderId,
    status,
    customerEmails: uniqueEmails(order?.pocEmail, order?.businessEmail, order?.email),
    userId: order?.customerUserId,
  })

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
    .select({ id: customerAccounts.id, businessType: customerAccounts.businessType })
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

  const purchaseUnits = Array.from(new Set(existingItems.map((item) => item.unit))) as PurchaseUnit[]
  if (purchaseUnits.length !== 1) {
    throw new Error('Mixed-unit reorders are not supported for this order.')
  }

  const purchaseUnit = purchaseUnits[0]
  const { lineItems, subtotal } = await buildPricedLineItems({
    customerId: account.id,
    purchaseUnit,
    orderDate: new Date(),
    orderType: existingOrder.orderType,
    items: existingItems.map((item) => ({
      productId: item.productId,
      quantity: Number(item.quantity),
    })),
    customerBusinessType: account.businessType ?? null,
  })

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
    lineItems.map((item) => ({
      ...item,
      orderId: newOrder.id,
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
      notificationPhone: customerAccounts.notificationPhone,
      notificationPreference: customerAccounts.notificationPreference,
    })
    .from(orders)
    .leftJoin(customerAccounts, eq(orders.customerId, customerAccounts.id))
    .where(eq(orders.id, orderId))
    .limit(1)

  const prefersNoSms = order?.notificationPreference === 'email'
  await notify('order.shipping_status_changed', {
    companyName: order?.companyName ?? '',
    orderId,
    status: shippingStatus,
    customerEmails: uniqueEmails(order?.pocEmail, order?.businessEmail, order?.email),
    customerPhone: prefersNoSms ? null : (order?.notificationPhone ?? order?.phone ?? null),
    userId: order?.customerUserId,
  })

  revalidatePath('/admin/orders')
  revalidatePath('/staff/orders')
  revalidatePath(`/admin/orders/${orderId}`)
  revalidatePath(`/staff/orders/${orderId}`)
  revalidatePath(`/customer/orders/${orderId}`)
}
