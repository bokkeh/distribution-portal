'use server'

import { db } from '@/db'
import { customerAccounts, inventory, orderItems, orders, products } from '@/db/schema'
import { requireAuth } from '@/lib/auth/session'
import { eq, inArray } from 'drizzle-orm'
import { calculateCommissionForOrder, recordCommission } from '@/actions/sales-members'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { logInventoryTransaction } from '@/lib/inventory/history'
import { getMinimumCaseQuantity, isWisherVodkaProduct } from '@/lib/orders/minimums'
import { createUserNotification } from '@/lib/notifications/in-app'
import { notify } from '@/lib/notifications/dispatch'
import { logActivityEvent } from '@/lib/activity/log'
import { formatPaymentTerms } from '@/lib/orders/payment-terms'
import { getPricingRulesForProducts, normalizeAccountGeography, resolveProductCasePrice } from '@/lib/pricing/geographic-service'
import type { GeographicPricingSource } from '@/lib/pricing/geographic'

type PurchaseUnit = 'case' | 'bottle'

type PricingContext = {
  state: string | null
  county: string | null
}

function uniqueEmails(...values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => value?.trim()).filter(Boolean) as string[]))
}

function getBottleUnitPrice(product: typeof products.$inferSelect, resolvedCasePrice: number) {
  const explicitBottlePrice = parseFloat(product.bottlePrice || '0')
  if (explicitBottlePrice > 0) {
    return { unitPrice: explicitBottlePrice, inheritsCasePricing: false }
  }

  const bottlesPerCase = product.bottlesPerCase || 12
  return {
    unitPrice: resolvedCasePrice / bottlesPerCase,
    inheritsCasePricing: true,
  }
}

async function getAccountPricingContext(customerId: string): Promise<PricingContext> {
  const [account] = await db
    .select({
      state: customerAccounts.state,
      county: customerAccounts.county,
    })
    .from(customerAccounts)
    .where(eq(customerAccounts.id, customerId))
    .limit(1)

  if (!account) {
    throw new Error('Customer account not found')
  }

  return normalizeAccountGeography(account)
}

async function buildPricedLineItems(input: {
  customerId: string
  purchaseUnit: PurchaseUnit
  orderDate: Date
  items: { productId: string; quantity: number }[]
  customerBusinessType: string | null
}) {
  const productIds = input.items.map((item) => item.productId)
  const [productList, inventoryRows, pricingContext, pricingRules] = await Promise.all([
    db.select().from(products).where(inArray(products.id, productIds)),
    db.select().from(inventory).where(inArray(inventory.productId, productIds)),
    getAccountPricingContext(input.customerId),
    getPricingRulesForProducts(productIds),
  ])

  const productMap = Object.fromEntries(productList.map((product) => [product.id, product]))
  const inventoryMap = Object.fromEntries(inventoryRows.map((row) => [row.productId, row]))
  let subtotal = 0

  const lineItems = input.items.map((item) => {
    const product = productMap[item.productId]
    const inv = inventoryMap[item.productId]
    if (!product) {
      throw new Error(`Product ${item.productId} not found`)
    }
    if (!inv) {
      throw new Error(`Inventory record missing for product ${product.name}`)
    }

    const bottlesPerCase = product.bottlesPerCase || 12
    const availableQuantity = input.purchaseUnit === 'bottle'
      ? inv.quantityPaid * bottlesPerCase - inv.looseBottlePaid
      : inv.quantityPaid

    if (item.quantity > availableQuantity) {
      throw new Error(`Not enough ${input.purchaseUnit}s in stock for ${product.name}`)
    }

    if (
      input.purchaseUnit === 'case' &&
      isWisherVodkaProduct(product) &&
      item.quantity < getMinimumCaseQuantity(product, input.customerBusinessType)
    ) {
      throw new Error(`${product.name} requires a minimum order of ${getMinimumCaseQuantity(product, input.customerBusinessType)} cases`)
    }

    const pricing = resolveProductCasePrice({
      productId: item.productId,
      baseCasePrice: product.price,
      account: pricingContext,
      rules: pricingRules,
      asOf: input.orderDate,
      quantityCases: input.purchaseUnit === 'case' ? item.quantity : null,
    })

    const bottlePricing = getBottleUnitPrice(product, pricing.price)
    const unitPrice = input.purchaseUnit === 'case'
      ? pricing.price
      : bottlePricing.unitPrice

    const total = unitPrice * item.quantity
    subtotal += total

    const pricingSource: GeographicPricingSource | null =
      input.purchaseUnit === 'case' || bottlePricing.inheritsCasePricing
        ? pricing.source
        : null

    return {
      orderId: '',
      productId: item.productId,
      quantity: String(item.quantity),
      unit: input.purchaseUnit,
      unitPrice: unitPrice.toFixed(2),
      total: total.toFixed(2),
      pricingSource,
      pricingRuleId: pricingSource ? pricing.matchedRule?.id ?? null : null,
      pricingState: pricingSource ? pricing.matchedState : null,
      pricingCounty: pricingSource ? pricing.matchedCounty : null,
    }
  })

  return { lineItems, subtotal, productMap, inventoryMap }
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
    const requestedPaymentTerms = (formData.get('paymentTerms') as string | null)?.trim() || null
    const paymentMethod = (formData.get('paymentMethod') as string | null) ?? null
    const processingFee = Number((formData.get('processingFee') as string | null) ?? '0')
    const itemsJson = formData.get('items') as string
    const items: { productId: string; quantity: number }[] = JSON.parse(itemsJson)

    let customerBusinessType: string | null = null
    let defaultPaymentTerms = 'NET30'
    if (userRoles.includes('customer')) {
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
      defaultPaymentTerms = account.paymentTerms ?? 'NET30'
    } else {
      const [account] = await db
        .select({
          businessType: customerAccounts.businessType,
          paymentTerms: customerAccounts.paymentTerms,
        })
        .from(customerAccounts)
        .where(eq(customerAccounts.id, customerId))
        .limit(1)
      customerBusinessType = account?.businessType ?? null
      defaultPaymentTerms = account?.paymentTerms ?? 'NET30'
    }

    const paymentTerms = userRoles.includes('customer')
      ? defaultPaymentTerms
      : (requestedPaymentTerms || defaultPaymentTerms)

    const { lineItems, subtotal, productMap, inventoryMap } = await buildPricedLineItems({
      customerId,
      purchaseUnit,
      orderDate: new Date(),
      items,
      customerBusinessType,
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
      `Payment terms: ${formatPaymentTerms(paymentTerms)}.`,
      deliverySummary,
      paymentMethod === 'card' && sanitizedProcessingFee > 0
        ? `Card processing fee paid by customer: $${sanitizedProcessingFee.toFixed(2)}.`
        : null,
    ].filter(Boolean).join('\n')

    const [order] = await db.insert(orders).values({
      customerId,
      createdBy: session.user.id,
      orderType: 'paid',
      paymentTerms,
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

    return {
      success: true as const,
      redirectTo: userRoles.includes('customer')
        ? `/customer/orders/${order.id}`
        : userRoles.includes('admin')
          ? `/admin/orders/${order.id}`
          : `/staff/orders/${order.id}`,
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
    customerPhone: prefersNoSms ? null : (order?.phone ?? null),
    userId: order?.customerUserId,
  })

  revalidatePath('/admin/orders')
  revalidatePath('/staff/orders')
  revalidatePath(`/admin/orders/${orderId}`)
  revalidatePath(`/staff/orders/${orderId}`)
  revalidatePath(`/customer/orders/${orderId}`)
}
