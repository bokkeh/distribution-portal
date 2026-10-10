'use server'

import { createHash, randomUUID } from 'node:crypto'
import { z } from 'zod'
import { and, eq, sql } from 'drizzle-orm'
import { after } from 'next/server'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { fieldDocuments, inventory, invoices, invoiceItems, orders, orderItems } from '@/db/schema'
import { fieldAccount } from '@/lib/field/access'
import { fieldDocumentSchema, type FieldDocumentInput } from '@/lib/field/validation'
import { buildPricedLineItems } from '@/lib/orders/checkout'
import { createInvoicePublicToken, getInvoicePublicPaymentPath } from '@/lib/invoices/public-token'
import { createPublicPaymentIntent } from '@/actions/invoices'
import { sendFieldInvoiceEmail } from '@/lib/resend/client'
import { logActivityEvent } from '@/lib/activity/log'

function refresh(accountId: string) {
  for (const path of ['/field', '/admin/invoicing', '/staff/invoicing', '/admin/orders', '/staff/orders', '/sales/dashboard', '/admin/dashboard', '/staff/dashboard', `/admin/crm/${accountId}`, `/staff/crm/${accountId}`, `/sales/accounts/${accountId}`]) revalidatePath(path)
}

async function priceDocument(input: ReturnType<typeof fieldDocumentSchema.parse>) {
  const { account, session, member } = await fieldAccount(input.accountId)
  if (input.kind === 'invoice' && !session.user.roles.some(role => ['admin', 'staff'].includes(role))) throw new Error('Quick invoices require staff or administrator access. You can create an order with its invoice instead.')
  if (input.kind === 'order' || input.items.length) {
    const priced = await buildPricedLineItems({ customerId: account.id, customerBusinessType: account.businessType, purchaseUnit: 'case', orderType: 'paid', orderDate: new Date(), items: input.items, checkInventory: input.kind === 'order' })
    if (input.items.some(item => !priced.productMap.get(item.productId)?.active)) throw new Error('A selected product is inactive. Choose an active product.')
    const total = (Math.round(priced.subtotal * 100) + Math.round(Number(input.tax) * 100)) / 100
    return { ...priced, account, session, member, total: total.toFixed(2), amount: priced.subtotal.toFixed(2) }
  }
  return { account, session, member, total: ((Math.round(Number(input.amount) * 100) + Math.round(Number(input.tax) * 100)) / 100).toFixed(2), amount: Number(input.amount).toFixed(2) }
}

export async function quoteFieldDocument(raw: FieldDocumentInput) {
  const parsed = fieldDocumentSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  try {
    const priced = await priceDocument(parsed.data)
    return { success: true as const, total: priced.total, amount: priced.amount,
      lines: 'lineItems' in priced ? priced.lineItems.map(item => ({ name: priced.productMap.get(item.productId)?.name ?? 'Product', quantity: item.quantity, unitPrice: item.unitPrice, total: item.total })) : [{ name: parsed.data.description, quantity: '1', unitPrice: priced.amount, total: priced.amount }] }
  } catch (error) { return { error: error instanceof Error ? error.message : 'Could not load current prices. Retry.' } }
}

export async function saveFieldDocument(raw: FieldDocumentInput) {
  const parsed = fieldDocumentSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const input = parsed.data
  try {
    const { session, account } = await fieldAccount(input.accountId)
    const fingerprint = createHash('sha256').update(JSON.stringify(input)).digest('hex')
    const readSaved = async () => {
      const [existing] = await db.select({ document: fieldDocuments, invoice: invoices }).from(fieldDocuments).innerJoin(invoices, eq(fieldDocuments.invoiceId, invoices.id)).where(eq(fieldDocuments.id, input.requestId)).limit(1)
      if (!existing) return null
      if (existing.document.createdByUserId !== session.user.id || existing.document.accountId !== account.id || existing.document.fingerprint !== fingerprint) throw new Error('This request was saved with different details. Start another entry.')
      refresh(account.id)
      return { success: true as const, requestId: existing.document.id, invoiceId: existing.invoice.id, invoiceNumber: existing.invoice.invoiceNumber, total: existing.invoice.total, orderId: existing.document.orderId, paymentMethod: existing.document.paymentMethod, email: existing.document.recipientEmail, paymentPath: getInvoicePublicPaymentPath(existing.invoice.id) }
    }
    const existing = await readSaved()
    if (existing) return existing
    const priced = await priceDocument(input)
    if (!input.quotedTotal || input.quotedTotal !== priced.total) return { error: 'Prices changed or the total has not been reviewed. Review the current total before saving.' }
    const invoiceId = randomUUID()
    // Verify link configuration before committing a document that must be shareable.
    const paymentPath = getInvoicePublicPaymentPath(invoiceId)
    const invoiceNumber = `INV-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${invoiceId.slice(0, 8).toUpperCase()}`
    const orderId = input.kind === 'order' ? randomUUID() : null
    const invoiceInsert = db.insert(invoices).values({ id: invoiceId, customerId: account.id, orderId, invoiceNumber, amount: priced.amount, tax: Number(input.tax).toFixed(2), total: priced.total, status: 'draft' })
    const documentInsert = db.insert(fieldDocuments).values({ id: input.requestId, accountId: account.id, createdByUserId: session.user.id, kind: input.kind, fingerprint, orderId, invoiceId, paymentMethod: input.paymentMethod, recipientEmail: input.email })
    try {
      if (orderId && 'lineItems' in priced) {
        const invoiceLines = priced.lineItems.map(item => ({ invoiceId, productId: item.productId, description: priced.productMap.get(item.productId)?.name ?? 'Product', sku: priced.productMap.get(item.productId)?.sku, quantity: item.quantity, unit: 'case', unitPrice: item.unitPrice, total: item.total }))
        // Neon batch is one Postgres transaction. NOT NULL aborts the entire batch if a
        // competing reservation consumed stock after the quote; no clamp-to-zero sale.
        const stockUpdates = input.items.map(item => db.update(inventory).set({ quantityPaid: sql`CASE WHEN ${inventory.quantityPaid} >= ${item.quantity} THEN ${inventory.quantityPaid} - ${item.quantity} ELSE NULL END`, updatedAt: new Date() }).where(eq(inventory.id, priced.inventoryMap.get(item.productId)!.id)))
        await db.batch([
          db.insert(orders).values({ id: orderId, customerId: account.id, createdBy: session.user.id, orderType: 'paid', status: 'pending', paymentStatus: input.paymentMethod === 'stripe' ? 'requires_action' : 'unpaid', paymentMethod: input.paymentMethod, paymentTerms: input.paymentMethod === 'cod' ? 'COD' : input.paymentMethod === 'stripe' ? 'PREPAID' : account.paymentTerms, subtotal: priced.amount, tax: Number(input.tax).toFixed(2), total: priced.total, notes: input.notes || null, isAssisted: true, assistedByUserId: session.user.id, assistanceType: 'field_placed', attributedSalesMemberId: priced.member?.id ?? account.assignedSalesRepId, attributionSource: 'manual' }),
          db.insert(orderItems).values(priced.lineItems.map(item => ({ ...item, orderId }))),
          invoiceInsert, db.insert(invoiceItems).values(invoiceLines), ...stockUpdates, documentInsert,
        ])
      } else if ('lineItems' in priced) {
        const invoiceLines = priced.lineItems.map((item, index) => ({ invoiceId, productId: item.productId, description: (priced.productMap.get(item.productId)?.name ?? 'Product') + (index === 0 && input.notes ? `\nNotes: ${input.notes}` : ''), sku: priced.productMap.get(item.productId)?.sku, quantity: item.quantity, unit: 'case', unitPrice: item.unitPrice, total: item.total }))
        await db.batch([invoiceInsert, db.insert(invoiceItems).values(invoiceLines), documentInsert])
      } else {
        await db.batch([invoiceInsert, db.insert(invoiceItems).values({ invoiceId, description: input.description + (input.notes ? `\nNotes: ${input.notes}` : ''), quantity: '1', unit: 'service', unitPrice: priced.amount, total: priced.amount }), documentInsert])
      }
    } catch (error) {
      // Concurrent/lost-response retries resolve to the one committed request.
      const retry = await readSaved()
      if (retry) return retry
      console.error('Field document transaction failed:', error)
      return { error: 'Could not save. Stock may have changed or the connection failed. Review again and retry; your entry is kept.' }
    }
    refresh(account.id)
    after(async () => {
      try { await logActivityEvent({ entityType: orderId ? 'order' : 'invoice', entityId: orderId ?? invoiceId, actorUserId: session.user.id, kind: 'field_document_created', title: orderId ? 'Field order and invoice created' : 'Field invoice created', body: `${invoiceNumber} · $${priced.total} · ${input.paymentMethod}`, metadata: { invoiceId, requestId: input.requestId } }) } catch (error) { console.error('Field document saved; audit failed:', error) }
    })
    return { success: true as const, requestId: input.requestId, invoiceId, invoiceNumber, total: priced.total, orderId, paymentMethod: input.paymentMethod, email: input.email, paymentPath }
  } catch (error) { return { error: error instanceof Error ? error.message : 'Could not confirm save. Keep this entry and retry.' } }
}

async function authorizedDocument(requestId: string) {
  const [row] = await db.select({ document: fieldDocuments, invoice: invoices }).from(fieldDocuments).innerJoin(invoices, eq(fieldDocuments.invoiceId, invoices.id)).where(eq(fieldDocuments.id, requestId)).limit(1)
  if (!row) throw new Error('Field invoice not found.')
  const access = await fieldAccount(row.document.accountId)
  return { ...row, ...access }
}

export async function getFieldDocument(requestId: string) {
  const { document, invoice, account } = await authorizedDocument(requestId)
  return { requestId: document.id, invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber, total: invoice.total, orderId: document.orderId, paymentMethod: document.paymentMethod, email: document.recipientEmail, emailSentAt: document.emailSentAt?.toISOString() ?? null, status: invoice.status, accountName: account.companyName, accountId: account.id, paymentPath: getInvoicePublicPaymentPath(invoice.id) }
}

export async function sendFieldInvoice(requestId: string, recipientEmail?: string) {
  try {
    const { document, invoice, account } = await authorizedDocument(requestId)
    if (recipientEmail && !z.email().max(254).safeParse(recipientEmail).success) return { error: 'Enter a valid customer email or share the invoice link.' }
    const email = recipientEmail || document.recipientEmail
    if (!email) return { error: 'Invoice saved. Add a customer email or share its secure link.' }
    if (document.emailSentAt) return { success: true as const, message: `Invoice already emailed to ${document.recipientEmail}.` }
    const sent = await sendFieldInvoiceEmail({ to: email, companyName: account.companyName, invoiceNumber: invoice.invoiceNumber, total: invoice.total, paymentMethod: document.paymentMethod, invoicePath: getInvoicePublicPaymentPath(invoice.id) })
    if (!sent) return { error: 'Invoice saved, but email delivery failed. Share its secure link or retry sending; do not create another invoice.' }
    await db.update(fieldDocuments).set({ emailSentAt: new Date(), recipientEmail: email }).where(eq(fieldDocuments.id, requestId))
    await db.update(invoices).set({ status: 'sent' }).where(and(eq(invoices.id, invoice.id), eq(invoices.status, 'draft')))
    refresh(account.id)
    return { success: true as const, message: `Invoice emailed to ${email}.` }
  } catch { return { error: 'Invoice saved, but email could not be confirmed. Check its status before retrying.' } }
}

export async function startFieldCardPayment(requestId: string) {
  const { document, invoice } = await authorizedDocument(requestId)
  if (document.paymentMethod !== 'stripe') throw new Error('This entry is set to check or COD. Create a Stripe entry or use the account’s normal payment workflow.')
  if (invoice.status === 'draft') {
    await db.update(invoices).set({ status: 'sent' }).where(and(eq(invoices.id, invoice.id), eq(invoices.status, 'draft')))
  }
  return createPublicPaymentIntent(createInvoicePublicToken(invoice.id), 'card')
}
