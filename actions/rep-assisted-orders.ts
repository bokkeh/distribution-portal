'use server'

import { randomBytes } from 'crypto'
import { and, desc, eq, ilike, or } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import {
  customerAccounts,
  inventory,
  invoiceItems,
  invoices,
  orderItems,
  orders,
  repAssistedOrders,
  salesMembers,
} from '@/db/schema'
import { requireRole } from '@/lib/auth/session'
import { logActivityEvent } from '@/lib/activity/log'
import { buildPricedLineItems, type PurchaseUnit } from '@/lib/orders/checkout'
import {
  createRepAssistedAccessToken,
  getRepAssistedReviewUrl,
  getRepAssistedTokenExpiration,
} from '@/lib/orders/rep-assisted-token'
import { sendRepAssistedOrderEmail } from '@/lib/resend/client'
import { sendSms } from '@/lib/telnyx/client'
import { upsertHubSpotContact } from '@/lib/hubspot/client'
import { getRepAssistedOrderByToken } from '@/lib/orders/rep-assisted-read'

type DraftPayload = {
  accountMode: 'existing' | 'new'
  customerId?: string
  companyName?: string
  businessType?: string
  contactName?: string
  contactTitle?: string
  email: string
  phone: string
  address?: string
  city?: string
  state?: string
  zip?: string
  paymentTerms?: string
  purchaseUnit: PurchaseUnit
  items: Array<{ productId: string; quantity: number }>
  discountPercent: number
  shipping: number
  tax: number
  purchaseOrderNumber?: string
  requestedDeliveryDate?: string
  customerFacingNotes?: string
  internalNotes?: string
  billingAddress?: string
  shippingAddress?: string
}

function textValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim()
}

function moneyValue(formData: FormData, key: string) {
  const value = Number(textValue(formData, key) || '0')
  if (!Number.isFinite(value) || value < 0) throw new Error(`${key} must be a non-negative number.`)
  return value
}

function parsePayload(formData: FormData): DraftPayload {
  const email = textValue(formData, 'email').toLowerCase()
  const phone = textValue(formData, 'phone')
  const items = JSON.parse(textValue(formData, 'items') || '[]') as Array<{ productId: string; quantity: number }>
  const normalizedItems = items
    .map((item) => ({ productId: String(item.productId), quantity: Number(item.quantity) }))
    .filter((item) => item.productId && Number.isFinite(item.quantity) && item.quantity > 0)

  return {
    accountMode: textValue(formData, 'accountMode') === 'new' ? 'new' : 'existing',
    customerId: textValue(formData, 'customerId') || undefined,
    companyName: textValue(formData, 'companyName') || undefined,
    businessType: textValue(formData, 'businessType') || undefined,
    contactName: textValue(formData, 'contactName') || undefined,
    contactTitle: textValue(formData, 'contactTitle') || undefined,
    email,
    phone,
    address: textValue(formData, 'address') || undefined,
    city: textValue(formData, 'city') || undefined,
    state: textValue(formData, 'state') || undefined,
    zip: textValue(formData, 'zip') || undefined,
    paymentTerms: textValue(formData, 'paymentTerms') || 'PREPAID',
    purchaseUnit: textValue(formData, 'purchaseUnit') === 'bottle' ? 'bottle' : 'case',
    items: normalizedItems,
    discountPercent: moneyValue(formData, 'discountPercent'),
    shipping: moneyValue(formData, 'shipping'),
    tax: moneyValue(formData, 'tax'),
    purchaseOrderNumber: textValue(formData, 'purchaseOrderNumber') || undefined,
    requestedDeliveryDate: textValue(formData, 'requestedDeliveryDate') || undefined,
    customerFacingNotes: textValue(formData, 'customerFacingNotes') || undefined,
    internalNotes: textValue(formData, 'internalNotes') || undefined,
    billingAddress: textValue(formData, 'billingAddress') || undefined,
    shippingAddress: textValue(formData, 'shippingAddress') || undefined,
  }
}

async function getSalesContext() {
  const session = await requireRole('sales_rep', 'sales_manager', 'admin')
  const roles = session.user.roles ?? [session.user.role]
  const canManageAny = roles.includes('admin') || roles.includes('sales_manager')
  const [member] = await db
    .select({ id: salesMembers.id })
    .from(salesMembers)
    .where(eq(salesMembers.userId, session.user.id))
    .limit(1)

  if (!member && !roles.includes('admin')) throw new Error('No active sales member profile found.')
  return { session, salesMemberId: member?.id ?? null, canManageAny }
}

async function assertAccountAccess(customerId: string, salesMemberId: string | null, canManageAny: boolean) {
  const [account] = await db.select().from(customerAccounts).where(eq(customerAccounts.id, customerId)).limit(1)
  if (!account) throw new Error('Customer account not found.')
  if (!canManageAny && account.assignedSalesRepId !== salesMemberId) throw new Error('You are not authorized to order for this account.')
  return account
}

function generateInvoiceNumber() {
  const date = new Date().toISOString().slice(0, 10).replaceAll('-', '')
  return `INV-${date}-${randomBytes(2).toString('hex').toUpperCase()}`
}

async function sendWorkflowEmail(workflow: typeof repAssistedOrders.$inferSelect, token: string) {
  if (!workflow.orderId || !workflow.invoiceId || !workflow.customerId) throw new Error('Order is not ready to send.')
  const [details] = await db
    .select({
      companyName: customerAccounts.companyName,
      orderTotal: orders.total,
      invoiceNumber: invoices.invoiceNumber,
    })
    .from(repAssistedOrders)
    .innerJoin(customerAccounts, eq(repAssistedOrders.customerId, customerAccounts.id))
    .innerJoin(orders, eq(repAssistedOrders.orderId, orders.id))
    .innerJoin(invoices, eq(repAssistedOrders.invoiceId, invoices.id))
    .where(eq(repAssistedOrders.id, workflow.id))
    .limit(1)
  if (!details) throw new Error('Order details are unavailable.')

  const sent = await sendRepAssistedOrderEmail({
    to: workflow.recipientEmail,
    businessName: details.companyName,
    orderNumber: workflow.orderId.slice(-8).toUpperCase(),
    invoiceNumber: details.invoiceNumber,
    total: details.orderTotal,
    salesRepName: 'Your AHAWC sales representative',
    reviewUrl: getRepAssistedReviewUrl(token),
    expiresAt: workflow.accessTokenExpiresAt,
  })
  if (!sent) throw new Error('Email provider rejected the message.')
}

async function sendWorkflowSms(workflow: typeof repAssistedOrders.$inferSelect, token: string) {
  if (!workflow.orderId || !workflow.customerId) throw new Error('Order is not ready to send.')
  const [account] = await db
    .select({ companyName: customerAccounts.companyName })
    .from(customerAccounts)
    .where(eq(customerAccounts.id, workflow.customerId))
    .limit(1)
  await sendSms({
    to: workflow.recipientPhone,
    body: `${account?.companyName ?? 'AHAWC'}: Your order #${workflow.orderId.slice(-8).toUpperCase()} is ready to review and pay. Secure link: ${getRepAssistedReviewUrl(token)} Reply STOP to opt out.`,
    contactName: account?.companyName,
  })
}

export async function searchRepCustomers(query: string) {
  const { salesMemberId, canManageAny } = await getSalesContext()
  const term = `%${query.trim()}%`
  const match = or(
    ilike(customerAccounts.companyName, term),
    ilike(customerAccounts.contactName, term),
    ilike(customerAccounts.email, term),
    ilike(customerAccounts.phone, term),
    ilike(customerAccounts.hubspotCompanyId, term),
    ilike(customerAccounts.dcAbraNumber, term),
  )
  return db
    .select()
    .from(customerAccounts)
    .where(canManageAny ? match : and(eq(customerAccounts.assignedSalesRepId, salesMemberId!), match))
    .orderBy(customerAccounts.companyName)
    .limit(20)
}

export async function saveRepAssistedOrderDraft(formData: FormData) {
  try {
    const { session, salesMemberId } = await getSalesContext()
    const payload = parsePayload(formData)
    const idempotencyKey = textValue(formData, 'idempotencyKey')
    if (!idempotencyKey) throw new Error('Missing draft key.')
    const { hash } = createRepAssistedAccessToken()

    const [existing] = await db.select({ id: repAssistedOrders.id }).from(repAssistedOrders).where(eq(repAssistedOrders.idempotencyKey, idempotencyKey)).limit(1)
    if (existing) {
      await db.update(repAssistedOrders).set({ draftData: payload, updatedAt: new Date() }).where(eq(repAssistedOrders.id, existing.id))
      return { success: true as const, workflowId: existing.id }
    }

    const [draft] = await db.insert(repAssistedOrders).values({
      idempotencyKey,
      createdByUserId: session.user.id,
      salesMemberId,
      status: 'draft',
      recipientEmail: payload.email,
      recipientPhone: payload.phone,
      draftData: payload,
      accessTokenHash: hash,
      accessTokenExpiresAt: getRepAssistedTokenExpiration(),
    }).returning({ id: repAssistedOrders.id })

    await logActivityEvent({ entityType: 'order', entityId: draft.id, actorUserId: session.user.id, kind: 'rep_order_draft_saved', title: 'Rep-assisted order draft saved' })
    return { success: true as const, workflowId: draft.id }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unable to save draft.' }
  }
}

export async function submitRepAssistedOrder(formData: FormData) {
  const { session, salesMemberId, canManageAny } = await getSalesContext()
  const payload = parsePayload(formData)
  const idempotencyKey = textValue(formData, 'idempotencyKey')
  if (!idempotencyKey) return { error: 'Missing submission key.' }
  if (!payload.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) return { error: 'Enter a valid customer email.' }
  if (!payload.phone) return { error: 'Enter a customer mobile number.' }
  if (!payload.items.length) return { error: 'Add at least one product.' }

  const maxDiscount = canManageAny ? 100 : Number(process.env.REP_MAX_DISCOUNT_PERCENT ?? '10')
  if (payload.discountPercent > maxDiscount) return { error: `Your maximum authorized discount is ${maxDiscount}%.` }

  const [existing] = await db.select().from(repAssistedOrders).where(eq(repAssistedOrders.idempotencyKey, idempotencyKey)).limit(1)
  if (existing?.orderId && existing.invoiceId) return { success: true as const, workflowId: existing.id, redirectTo: `/sales/orders/assisted/${existing.id}` }

  const tokenPair = createRepAssistedAccessToken()
  const expiresAt = getRepAssistedTokenExpiration()
  let workflow = existing
  if (workflow) {
    await db.update(repAssistedOrders).set({
      status: 'ready_to_send', draftData: payload, recipientEmail: payload.email, recipientPhone: payload.phone,
      accessTokenHash: tokenPair.hash, accessTokenExpiresAt: expiresAt, updatedAt: new Date(),
    }).where(eq(repAssistedOrders.id, workflow.id))
    ;[workflow] = await db.select().from(repAssistedOrders).where(eq(repAssistedOrders.id, workflow.id)).limit(1)
  } else {
    ;[workflow] = await db.insert(repAssistedOrders).values({
      idempotencyKey, createdByUserId: session.user.id, salesMemberId, status: 'ready_to_send',
      recipientEmail: payload.email, recipientPhone: payload.phone, draftData: payload,
      accessTokenHash: tokenPair.hash, accessTokenExpiresAt: expiresAt,
      customerFacingNotes: payload.customerFacingNotes, internalNotes: payload.internalNotes,
      purchaseOrderNumber: payload.purchaseOrderNumber, requestedDeliveryDate: payload.requestedDeliveryDate,
      shippingAddress: payload.shippingAddress, billingAddress: payload.billingAddress,
    }).returning()
  }

  let createdOrderId: string | null = null
  let createdInvoiceId: string | null = null
  const adjustedInventory: Array<{ id: string; quantityPaid: number; looseBottlePaid: number }> = []
  try {
    let account
    if (payload.accountMode === 'existing') {
      if (!payload.customerId) throw new Error('Select an existing customer.')
      account = await assertAccountAccess(payload.customerId, salesMemberId, canManageAny)
    } else {
      if (!payload.companyName) throw new Error('Business name is required for a new account.')
      const duplicateMatches = await db.select({ id: customerAccounts.id, companyName: customerAccounts.companyName })
        .from(customerAccounts)
        .where(or(ilike(customerAccounts.companyName, payload.companyName), eq(customerAccounts.email, payload.email)))
        .limit(3)
      if (duplicateMatches.length) throw new Error(`Possible duplicate account: ${duplicateMatches.map((item) => item.companyName).join(', ')}. Select the existing record or change the account details.`)

      ;[account] = await db.insert(customerAccounts).values({
        companyName: payload.companyName,
        businessType: payload.businessType,
        contactName: payload.contactName,
        pocName: payload.contactName,
        email: payload.email,
        businessEmail: payload.email,
        pocEmail: payload.email,
        phone: payload.phone,
        businessPhone: payload.phone,
        pocPhone: payload.phone,
        address: payload.address,
        city: payload.city,
        state: payload.state,
        zip: payload.zip,
        paymentTerms: payload.paymentTerms,
        assignedSalesRepId: salesMemberId,
        customerSource: 'manual',
      }).returning()

      const hubspotContactId = await upsertHubSpotContact({
        email: payload.email,
        firstname: (payload.contactName ?? payload.companyName).split(' ')[0],
        lastname: (payload.contactName ?? '').split(' ').slice(1).join(' '),
        company: payload.companyName,
        phone: payload.phone,
        city: payload.city ?? '',
        state: payload.state ?? '',
        credit_limit: '0',
        payment_terms: payload.paymentTerms ?? 'PREPAID',
        account_balance: '0',
      }).catch(() => null)
      if (hubspotContactId) await db.update(customerAccounts).set({ hubspotContactId }).where(eq(customerAccounts.id, account.id))
      await logActivityEvent({ entityType: 'account', entityId: account.id, actorUserId: session.user.id, kind: 'rep_assisted_account_created', title: 'Account created from rep-assisted order' })
    }

    const { lineItems, subtotal, productMap, inventoryMap } = await buildPricedLineItems({
      customerId: account.id,
      purchaseUnit: payload.purchaseUnit,
      orderDate: new Date(),
      orderType: 'paid',
      items: payload.items,
      customerBusinessType: account.businessType,
    })
    const discount = subtotal * (payload.discountPercent / 100)
    const amount = Math.max(0, subtotal - discount + payload.shipping)
    const total = amount + payload.tax
    const notes = [
      payload.customerFacingNotes,
      payload.purchaseOrderNumber ? `Purchase order: ${payload.purchaseOrderNumber}` : null,
      payload.requestedDeliveryDate ? `Requested delivery: ${payload.requestedDeliveryDate}` : null,
      payload.shippingAddress ? `Shipping address: ${payload.shippingAddress}` : null,
    ].filter(Boolean).join('\n')

    const [order] = await db.insert(orders).values({
      customerId: account.id,
      createdBy: session.user.id,
      orderType: 'paid',
      paymentTerms: payload.paymentTerms ?? account.paymentTerms ?? 'PREPAID',
      paymentStatus: 'requires_action',
      status: 'pending',
      subtotal: subtotal.toFixed(2),
      tax: payload.tax.toFixed(2),
      total: total.toFixed(2),
      notes: notes || null,
      attributedSalesMemberId: salesMemberId,
      attributionSource: 'manual',
    }).returning()
    createdOrderId = order.id
    await db.insert(orderItems).values(lineItems.map((item) => ({ ...item, orderId: order.id })))

    const [invoice] = await db.insert(invoices).values({
      orderId: order.id,
      customerId: account.id,
      invoiceNumber: generateInvoiceNumber(),
      amount: amount.toFixed(2),
      tax: payload.tax.toFixed(2),
      total: total.toFixed(2),
      status: 'sent',
    }).returning()
    createdInvoiceId = invoice.id
    const itemRows = lineItems.map((item) => {
      const product = productMap.get(item.productId)
      return {
        invoiceId: invoice.id,
        productId: item.productId,
        description: product?.name ?? 'Product',
        sku: product?.sku ?? null,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
        total: item.total,
      }
    })
    await db.insert(invoiceItems).values(itemRows)
    if (payload.shipping > 0) {
      await db.insert(invoiceItems).values({ invoiceId: invoice.id, description: 'Shipping', quantity: '1', unit: 'service', unitPrice: payload.shipping.toFixed(2), total: payload.shipping.toFixed(2) })
    }
    if (discount > 0) {
      await db.insert(invoiceItems).values({ invoiceId: invoice.id, description: `Discount (${payload.discountPercent}%)`, quantity: '1', unit: 'discount', unitPrice: (-discount).toFixed(2), total: (-discount).toFixed(2) })
    }

    for (const requested of payload.items) {
      const inv = inventoryMap.get(requested.productId)
      const product = productMap.get(requested.productId)
      if (!inv || !product) continue
      if (payload.purchaseUnit === 'case') {
        await db.update(inventory).set({ quantityPaid: Math.max(0, inv.quantityPaid - requested.quantity) }).where(eq(inventory.id, inv.id))
      } else {
        const perCase = product.bottlesPerCase || 12
        const loose = inv.looseBottlePaid + requested.quantity
        await db.update(inventory).set({ quantityPaid: Math.max(0, inv.quantityPaid - Math.floor(loose / perCase)), looseBottlePaid: loose % perCase }).where(eq(inventory.id, inv.id))
      }
      adjustedInventory.push({ id: inv.id, quantityPaid: inv.quantityPaid, looseBottlePaid: inv.looseBottlePaid })
    }

    await db.update(repAssistedOrders).set({
      orderId: order.id, invoiceId: invoice.id, customerId: account.id, status: 'awaiting_payment', updatedAt: new Date(),
    }).where(eq(repAssistedOrders.id, workflow.id))
    ;[workflow] = await db.select().from(repAssistedOrders).where(eq(repAssistedOrders.id, workflow.id)).limit(1)

    await logActivityEvent({
      entityType: 'order', entityId: order.id, actorUserId: session.user.id, kind: 'rep_assisted_order_submitted',
      title: 'Rep-assisted order submitted', body: `Invoice ${invoice.invoiceNumber} created for $${total.toFixed(2)}.`,
      metadata: { workflowId: workflow.id, invoiceId: invoice.id, discountPercent: payload.discountPercent },
    })

    const errors: Record<string, string> = {}
    let emailStatus: 'sent' | 'failed' = 'sent'
    let smsStatus: 'sent' | 'failed' = 'sent'
    try { await sendWorkflowEmail(workflow, tokenPair.token) } catch (error) { emailStatus = 'failed'; errors.email = error instanceof Error ? error.message : String(error) }
    try { await sendWorkflowSms(workflow, tokenPair.token) } catch (error) { smsStatus = 'failed'; errors.sms = error instanceof Error ? error.message : String(error) }
    await db.update(repAssistedOrders).set({
      emailStatus, emailSentAt: emailStatus === 'sent' ? new Date() : null,
      smsStatus, smsSentAt: smsStatus === 'sent' ? new Date() : null,
      notificationErrors: errors, status: 'awaiting_payment', updatedAt: new Date(),
    }).where(eq(repAssistedOrders.id, workflow.id))

    revalidatePath('/sales/dashboard')
    revalidatePath('/sales/orders/assisted')
    return { success: true as const, workflowId: workflow.id, redirectTo: `/sales/orders/assisted/${workflow.id}`, partialFailure: Object.keys(errors).length ? errors : undefined }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to submit order.'
    // Neon HTTP does not support an interactive transaction for this multi-step workflow.
    // Roll back the financial records on a pre-notification failure so a retry cannot duplicate them.
    await Promise.all(adjustedInventory.map((item) => db.update(inventory).set({ quantityPaid: item.quantityPaid, looseBottlePaid: item.looseBottlePaid }).where(eq(inventory.id, item.id)).catch(() => {})))
    if (createdInvoiceId) await db.delete(invoices).where(eq(invoices.id, createdInvoiceId)).catch(() => {})
    if (createdOrderId) await db.delete(orders).where(eq(orders.id, createdOrderId)).catch(() => {})
    await db.update(repAssistedOrders).set({ status: 'failed', notificationErrors: { workflow: message }, updatedAt: new Date() }).where(eq(repAssistedOrders.id, workflow.id))
    return { error: message, workflowId: workflow.id }
  }
}

async function getAuthorizedWorkflow(workflowId: string) {
  const { salesMemberId, canManageAny } = await getSalesContext()
  const [workflow] = await db.select().from(repAssistedOrders).where(eq(repAssistedOrders.id, workflowId)).limit(1)
  if (!workflow || (!canManageAny && workflow.salesMemberId !== salesMemberId)) throw new Error('Workflow not found or unauthorized.')
  return workflow
}

export async function resendRepAssistedNotification(workflowId: string, channel: 'email' | 'sms') {
  const workflow = await getAuthorizedWorkflow(workflowId)
  const { token, hash } = createRepAssistedAccessToken()
  const expiresAt = getRepAssistedTokenExpiration()
  await db.update(repAssistedOrders).set({ accessTokenHash: hash, accessTokenExpiresAt: expiresAt, revokedAt: null, updatedAt: new Date() }).where(eq(repAssistedOrders.id, workflow.id))
  const refreshed = { ...workflow, accessTokenHash: hash, accessTokenExpiresAt: expiresAt, revokedAt: null }
  try {
    if (channel === 'email') await sendWorkflowEmail(refreshed, token)
    else await sendWorkflowSms(refreshed, token)
    const history = Array.isArray(workflow.resendHistory) ? workflow.resendHistory : []
    await db.update(repAssistedOrders).set({
      [channel === 'email' ? 'emailStatus' : 'smsStatus']: 'sent',
      [channel === 'email' ? 'emailSentAt' : 'smsSentAt']: new Date(),
      resendHistory: [...history, { channel, sentAt: new Date().toISOString() }],
      updatedAt: new Date(),
    }).where(eq(repAssistedOrders.id, workflow.id))
    await logActivityEvent({ entityType: 'order', entityId: workflow.orderId!, kind: 'rep_order_notification_resent', title: `${channel.toUpperCase()} notification resent`, metadata: { workflowId } })
    revalidatePath(`/sales/orders/assisted/${workflow.id}`)
    return { success: true as const }
  } catch (error) {
    const message = error instanceof Error ? error.message : `Unable to resend ${channel}.`
    await db.update(repAssistedOrders).set({ [channel === 'email' ? 'emailStatus' : 'smsStatus']: 'failed', notificationErrors: { ...(workflow.notificationErrors as object), [channel]: message }, updatedAt: new Date() }).where(eq(repAssistedOrders.id, workflow.id))
    return { error: message }
  }
}

export async function cancelRepAssistedOrder(workflowId: string) {
  const workflow = await getAuthorizedWorkflow(workflowId)
  if (!workflow.orderId || !workflow.invoiceId) return { error: 'Order has not been created.' }
  const [invoice] = await db.select({ status: invoices.status }).from(invoices).where(eq(invoices.id, workflow.invoiceId)).limit(1)
  if (invoice?.status === 'paid') return { error: 'Paid orders cannot be cancelled.' }
  await db.update(orders).set({ status: 'cancelled' }).where(eq(orders.id, workflow.orderId))
  await db.update(repAssistedOrders).set({ status: 'cancelled', revokedAt: new Date(), updatedAt: new Date() }).where(eq(repAssistedOrders.id, workflow.id))
  revalidatePath('/sales/orders/assisted')
  revalidatePath(`/sales/orders/assisted/${workflow.id}`)
  return { success: true as const }
}

export async function listRepAssistedOrders() {
  const { salesMemberId, canManageAny } = await getSalesContext()
  return db
    .select({ workflow: repAssistedOrders, account: customerAccounts, order: orders, invoice: invoices })
    .from(repAssistedOrders)
    .leftJoin(customerAccounts, eq(repAssistedOrders.customerId, customerAccounts.id))
    .leftJoin(orders, eq(repAssistedOrders.orderId, orders.id))
    .leftJoin(invoices, eq(repAssistedOrders.invoiceId, invoices.id))
    .where(canManageAny ? undefined : eq(repAssistedOrders.salesMemberId, salesMemberId!))
    .orderBy(desc(repAssistedOrders.createdAt))
}

export async function getRepAssistedOrderDetail(workflowId: string) {
  await getAuthorizedWorkflow(workflowId)
  const [result] = await db
    .select({ workflow: repAssistedOrders, account: customerAccounts, order: orders, invoice: invoices })
    .from(repAssistedOrders)
    .leftJoin(customerAccounts, eq(repAssistedOrders.customerId, customerAccounts.id))
    .leftJoin(orders, eq(repAssistedOrders.orderId, orders.id))
    .leftJoin(invoices, eq(repAssistedOrders.invoiceId, invoices.id))
    .where(eq(repAssistedOrders.id, workflowId))
    .limit(1)
  return result ?? null
}

export async function confirmRepAssistedCustomerDetails(
  token: string,
  _previousState: { error?: string; success?: boolean } | null,
  formData: FormData,
) {
  const detail = await getRepAssistedOrderByToken(token)
  if (!detail) return { error: 'This secure link is invalid or expired.' }
  const email = textValue(formData, 'email').toLowerCase()
  const phone = textValue(formData, 'phone')
  const address = textValue(formData, 'address')
  const city = textValue(formData, 'city')
  const state = textValue(formData, 'state')
  const zip = textValue(formData, 'zip')
  const termsAccepted = formData.get('termsAccepted') === 'on'
  if (!email || !phone || !termsAccepted) return { error: 'Confirm your email, mobile number, and acceptance of the terms.' }

  await db.update(customerAccounts).set({ email, businessEmail: email, phone, businessPhone: phone, address, city, state, zip }).where(eq(customerAccounts.id, detail.account.id))
  await db.update(repAssistedOrders).set({
    recipientEmail: email, recipientPhone: phone, termsAccepted: true,
    invoiceViewedAt: detail.workflow.invoiceViewedAt ?? new Date(), status: 'awaiting_payment', updatedAt: new Date(),
  }).where(eq(repAssistedOrders.id, detail.workflow.id))
  await logActivityEvent({ entityType: 'order', entityId: detail.order.id, kind: 'rep_order_customer_details_confirmed', title: 'Customer confirmed order and delivery details', metadata: { workflowId: detail.workflow.id } })
  revalidatePath(`/order-review/${token}`)
  return { success: true as const }
}
