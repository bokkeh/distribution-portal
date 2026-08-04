'use server'

import { randomBytes } from 'crypto'
import Stripe from 'stripe'
import { and, eq, inArray } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import { activityEvents, invoices, invoiceItems, customerAccounts, journalEntries, journalEntryLines, chartOfAccounts, orders, products, repAssistedOrders } from '@/db/schema'
import { requireAdminOrStaff, requireAuth } from '@/lib/auth/session'
import { logActivityEvent } from '@/lib/activity/log'
import { resolveInvoiceIdFromPublicToken } from '@/lib/invoices/public-token'
import { notify } from '@/lib/notifications/dispatch'
import { getPricingRulesForProducts, normalizeAccountGeography } from '@/lib/pricing/geographic-service'
import { resolveProductUnitPrice } from '@/lib/pricing/product-price'
import { getCustomerPaymentBreakdown, type CustomerPaymentMethod } from '@/lib/stripe/fees'

if (!process.env.STRIPE_SECRET_KEY) throw new Error('Missing STRIPE_SECRET_KEY')
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-02-25.clover' })

function generateInvoiceNumber() {
  const now = new Date()
  const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
  const randomPart = randomBytes(2).toString('hex').toUpperCase()
  return `INV-${datePart}-${randomPart}`
}

function isInvoicePayable(status: string) {
  return status === 'sent' || status === 'overdue'
}

async function getFinanceAccounts() {
  const accounts = await db.select().from(chartOfAccounts)
  return {
    cashAccount: accounts.find(account => account.accountNumber === '1000') ?? accounts.find(account => account.type === 'asset'),
    arAccount: accounts.find(account => account.accountNumber === '1100') ?? accounts.find(account => account.type === 'asset'),
    revenueAccount: accounts.find(account => account.type === 'revenue'),
    expenseAccount: accounts.find(account => account.type === 'expense'),
  }
}

async function createJournalEntryForLines(input: {
  date?: string
  description: string
  reference?: string | null
  createdBy: string
  lines: Array<{
    accountId: string
    debit: string
    credit: string
    description: string
  }>
}) {
  const [entry] = await db.insert(journalEntries).values({
    date: input.date ?? new Date().toISOString().split('T')[0],
    description: input.description,
    reference: input.reference ?? null,
    createdBy: input.createdBy,
  }).returning()

  await db.insert(journalEntryLines).values(
    input.lines.map(line => ({
      entryId: entry.id,
      accountId: line.accountId,
      debit: line.debit,
      credit: line.credit,
      description: line.description,
    })),
  )

  return entry
}

async function getInvoiceSettlementContext(invoiceId: string) {
  const [invoice] = await db
    .select({
      id: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      orderId: invoices.orderId,
      total: invoices.total,
      status: invoices.status,
      companyName: customerAccounts.companyName,
      email: customerAccounts.email,
      businessEmail: customerAccounts.businessEmail,
      pocEmail: customerAccounts.pocEmail,
      accountUserId: customerAccounts.userId,
    })
    .from(invoices)
    .leftJoin(customerAccounts, eq(invoices.customerId, customerAccounts.id))
    .where(eq(invoices.id, invoiceId))
    .limit(1)

  return invoice ?? null
}

async function applyInvoicePaid(
  invoiceId: string,
  input: {
    actorUserId: string
    paymentReference: string
    journalReference: string
    skipJournalEntry?: boolean
  },
) {
  const invoice = await getInvoiceSettlementContext(invoiceId)
  if (!invoice || invoice.status === 'paid') return invoice

  await db.update(invoices).set({
    status: 'paid',
    paidAt: new Date(),
  }).where(eq(invoices.id, invoiceId))
  await db.update(repAssistedOrders).set({
    status: 'paid',
    paymentCompletedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(repAssistedOrders.invoiceId, invoiceId))

  await logActivityEvent({
    entityType: 'invoice',
    entityId: invoice.id,
    actorUserId: input.actorUserId,
    kind: 'invoice_paid',
    title: 'Invoice paid',
    body: `${invoice.invoiceNumber} was settled for $${Number(invoice.total).toFixed(2)}.`,
    metadata: { paymentReference: input.paymentReference },
  })

  if (invoice.orderId) {
    await logActivityEvent({
      entityType: 'order',
      entityId: invoice.orderId,
      actorUserId: input.actorUserId,
      kind: 'invoice_paid',
      title: 'Invoice marked paid',
      body: `${invoice.invoiceNumber} was marked paid for $${Number(invoice.total).toFixed(2)}.`,
      metadata: { invoiceId: invoice.id, paymentReference: input.paymentReference },
    })
  }

  if (!input.skipJournalEntry) {
    const { cashAccount, arAccount } = await getFinanceAccounts()
    if (cashAccount && arAccount) {
      await createJournalEntryForLines({
        description: `Payment received for ${invoice.invoiceNumber}`,
        reference: input.journalReference,
        createdBy: input.actorUserId,
        lines: [
          { accountId: cashAccount.id, debit: invoice.total, credit: '0', description: 'Cash received' },
          { accountId: arAccount.id, debit: '0', credit: invoice.total, description: 'AR cleared' },
        ],
      })
    }
  }

  const notifyEmails = Array.from(new Set(
    [invoice.pocEmail, invoice.businessEmail, invoice.email]
      .map(value => value?.trim())
      .filter(Boolean) as string[],
  ))

  await notify('invoice.paid', {
    companyName: invoice.companyName ?? '',
    invoiceNumber: invoice.invoiceNumber,
    total: invoice.total,
    notifyEmails,
  })

  revalidatePath('/admin/invoicing')
  revalidatePath('/admin/invoicing/aging')
  revalidatePath(`/admin/invoicing/${invoice.id}`)
  revalidatePath('/admin/accounts/journal')
  revalidatePath('/customer/invoices')
  revalidatePath(`/customer/invoices/${invoice.id}`)

  return invoice
}

export async function applyWebhookInvoicePaid(invoiceId: string, paymentIntentId: string, actorUserId: string) {
  return applyInvoicePaid(invoiceId, {
    actorUserId,
    paymentReference: paymentIntentId,
    journalReference: paymentIntentId,
  })
}

export async function createInvoice(formData: FormData) {
  await requireAdminOrStaff()

  const customerId = (formData.get('customerId') as string) || ''
  const orderId = (formData.get('orderId') as string) || ''
  let amount = Number(formData.get('amount') as string)
  let tax = Number((formData.get('tax') as string) || '0')
  const dueDate = (formData.get('dueDate') as string) || null
  const lineItemProductIds = formData.getAll('lineItemProductId')
  const lineItemDescriptions = formData.getAll('lineItemDescription')
  const lineItemSkus = formData.getAll('lineItemSku')
  const lineItemQuantities = formData.getAll('lineItemQuantity')
  const lineItemUnits = formData.getAll('lineItemUnit')
  const lineItemUnitPrices = formData.getAll('lineItemUnitPrice')
  const manualLineItems = lineItemProductIds
    .map((value, index) => ({
      productId: String(value || '').trim(),
      description: String(lineItemDescriptions[index] || '').trim(),
      sku: String(lineItemSkus[index] || '').trim(),
      quantity: Number(lineItemQuantities[index] || ''),
      unit: String(lineItemUnits[index] || 'case').trim(),
      unitPrice: Number(lineItemUnitPrices[index] || ''),
    }))
    .filter((item) => item.productId || item.description || item.quantity || item.unitPrice)

  if (!customerId) {
    redirect('/admin/invoicing/new?error=' + encodeURIComponent('Enter a valid customer, amount, and tax.'))
  }

  if (orderId) {
    const [order] = await db
      .select({
        id: orders.id,
        customerId: orders.customerId,
        status: orders.status,
        subtotal: orders.subtotal,
        tax: orders.tax,
        total: orders.total,
      })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1)

    if (!order) {
      redirect('/admin/invoicing/new?error=' + encodeURIComponent('Linked order not found.'))
    }

    if (order.customerId !== customerId) {
      redirect('/admin/invoicing/new?error=' + encodeURIComponent('The selected order belongs to a different customer account.'))
    }

    if (order.status !== 'fulfilled') {
      redirect('/admin/invoicing/new?error=' + encodeURIComponent('Only fulfilled orders can be invoiced.'))
    }

    const [existingInvoice] = await db
      .select({ id: invoices.id, invoiceNumber: invoices.invoiceNumber })
      .from(invoices)
      .where(eq(invoices.orderId, orderId))
      .limit(1)

    if (existingInvoice) {
      redirect(`/admin/invoicing/new?error=${encodeURIComponent(`Order already has invoice ${existingInvoice.invoiceNumber}.`)}`)
    }

    amount = Number(order.subtotal)
    tax = Number(order.tax)
  } else {
    if (!Number.isFinite(tax) || tax < 0) {
      redirect('/admin/invoicing/new?error=' + encodeURIComponent('Enter valid direct invoice products and tax.'))
    }

    if (manualLineItems.length === 0) {
      redirect('/admin/invoicing/new?error=' + encodeURIComponent('Add at least one product for a direct invoice.'))
    }

    const invalidLineItem = manualLineItems.find((item) => (
      !item.productId ||
      !item.description ||
      !Number.isFinite(item.quantity) ||
      item.quantity <= 0 ||
      !Number.isFinite(item.unitPrice) ||
      item.unitPrice < 0 ||
      !['case', 'bottle'].includes(item.unit)
    ))

    if (invalidLineItem) {
      redirect('/admin/invoicing/new?error=' + encodeURIComponent('Each direct invoice product needs a product, description, quantity, unit, and unit price.'))
    }

    const [account] = await db
      .select({
        accountId: customerAccounts.id,
        businessType: customerAccounts.businessType,
        state: customerAccounts.state,
        county: customerAccounts.county,
      })
      .from(customerAccounts)
      .where(eq(customerAccounts.id, customerId))
      .limit(1)

    if (!account) {
      redirect('/admin/invoicing/new?error=' + encodeURIComponent('Customer account not found.'))
    }

    const productIds = manualLineItems.map((item) => item.productId)
    const [productRows, pricingRules] = await Promise.all([
      db
        .select({
          id: products.id,
          name: products.name,
          sku: products.sku,
          price: products.price,
          bottlePrice: products.bottlePrice,
          bottlesPerCase: products.bottlesPerCase,
        })
        .from(products)
        .where(inArray(products.id, productIds)),
      getPricingRulesForProducts(productIds),
    ])

    const productMap = new Map(productRows.map((product) => [product.id, product]))
    const pricingAccount = normalizeAccountGeography(account)

    for (const item of manualLineItems) {
      const product = productMap.get(item.productId)
      if (!product) {
        redirect('/admin/invoicing/new?error=' + encodeURIComponent('One or more selected products no longer exist.'))
      }

      const resolved = resolveProductUnitPrice({
        product,
        account: pricingAccount,
        rules: pricingRules,
        purchaseUnit: item.unit as 'case' | 'bottle',
        quantity: item.quantity,
        asOf: new Date(),
      })

      item.description = item.description || product.name
      item.sku = product.sku ?? ''
      item.unitPrice = resolved.unitPrice
    }

    amount = Number(
      manualLineItems
        .reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
        .toFixed(2),
    )
  }

  const total = amount + tax

  const [invoice] = await db.insert(invoices).values({
    customerId,
    orderId: orderId || null,
    invoiceNumber: generateInvoiceNumber(),
    amount: amount.toFixed(2),
    tax: tax.toFixed(2),
    total: total.toFixed(2),
    status: 'draft',
    dueDate,
  }).returning()

  if (!orderId && manualLineItems.length > 0) {
    await db.insert(invoiceItems).values(
      manualLineItems.map((item) => ({
        invoiceId: invoice.id,
        productId: item.productId,
        description: item.description,
        sku: item.sku || null,
        quantity: item.quantity.toFixed(2),
        unit: item.unit,
        unitPrice: item.unitPrice.toFixed(2),
        total: (item.quantity * item.unitPrice).toFixed(2),
      })),
    )
  }

  revalidatePath('/admin/invoicing')
  redirect(`/admin/invoicing/${invoice.id}`)
}

export async function sendInvoiceEmail(invoiceId: string) {
  await requireAdminOrStaff()

  const [invoice] = await db
    .select({
      id: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      total: invoices.total,
      customerEmail: customerAccounts.email,
      companyName: customerAccounts.companyName,
    })
    .from(invoices)
    .leftJoin(customerAccounts, eq(invoices.customerId, customerAccounts.id))
    .where(eq(invoices.id, invoiceId))
    .limit(1)

  if (!invoice || !invoice.customerEmail) {
    redirect(`/admin/invoicing/${invoiceId}?error=${encodeURIComponent('Customer email is required before sending an invoice.')}`)
  }

  await notify('invoice.created', {
    customerEmail: invoice.customerEmail,
    invoiceNumber: invoice.invoiceNumber,
    companyName: invoice.companyName ?? '',
    total: invoice.total,
    invoiceUrl: `${process.env.NEXTAUTH_URL}/customer/invoices/${invoiceId}`,
  })

  await db.update(invoices).set({ status: 'sent' }).where(eq(invoices.id, invoiceId))
  revalidatePath('/admin/invoicing')
  revalidatePath(`/admin/invoicing/${invoiceId}`)
}

export async function markInvoicePaid(invoiceId: string) {
  const session = await requireAdminOrStaff()
  await applyInvoicePaid(invoiceId, {
    actorUserId: session.user.id,
    paymentReference: 'manual_mark_paid',
    journalReference: invoiceId,
  })
}

export async function deleteDraftInvoice(invoiceId: string) {
  const session = await requireAdminOrStaff()

  const [invoice] = await db
    .select({
      id: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      status: invoices.status,
      orderId: invoices.orderId,
      customerId: invoices.customerId,
    })
    .from(invoices)
    .where(eq(invoices.id, invoiceId))
    .limit(1)

  if (!invoice) {
    redirect('/admin/invoicing?error=' + encodeURIComponent('Invoice not found.'))
  }

  if (invoice.status !== 'draft') {
    redirect(`/admin/invoicing/${invoice.id}?error=${encodeURIComponent('Only draft invoices can be deleted.')}`)
  }

  if (invoice.orderId) {
    await logActivityEvent({
      entityType: 'order',
      entityId: invoice.orderId,
      actorUserId: session.user.id,
      kind: 'invoice_deleted',
      title: 'Draft invoice deleted',
      body: `${invoice.invoiceNumber} was deleted before it was sent.`,
      metadata: { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber },
    })
  }

  await db
    .delete(activityEvents)
    .where(and(
      eq(activityEvents.entityType, 'invoice'),
      eq(activityEvents.entityId, invoice.id),
    ))

  await db.delete(invoices).where(eq(invoices.id, invoice.id))

  revalidatePath('/admin/invoicing')
  revalidatePath('/admin/invoicing/aging')
  revalidatePath('/staff/invoicing')

  if (invoice.orderId) {
    revalidatePath(`/admin/orders/${invoice.orderId}`)
    revalidatePath(`/staff/orders/${invoice.orderId}`)
  }

  if (invoice.customerId) {
    revalidatePath(`/admin/crm/${invoice.customerId}`)
    revalidatePath(`/staff/crm/${invoice.customerId}`)
    revalidatePath(`/sales/accounts/${invoice.customerId}`)
  }

  const success = encodeURIComponent(`${invoice.invoiceNumber} was deleted. You can create a new invoice now.`)
  if (invoice.orderId) {
    redirect(`/admin/invoicing/new?orderId=${invoice.orderId}&customerId=${invoice.customerId}&success=${success}`)
  }

  redirect(`/admin/invoicing/new?customerId=${invoice.customerId}&success=${success}`)
}

export async function recordOfflineInvoicePayment(formData: FormData) {
  const session = await requireAdminOrStaff()
  const invoiceId = (formData.get('invoiceId') as string) || ''
  const amount = Number(formData.get('amount') as string)
  const note = (formData.get('note') as string) || 'Offline payment recorded.'

  if (!invoiceId || !Number.isFinite(amount) || amount <= 0) {
    redirect('/admin/invoicing?error=' + encodeURIComponent('Enter a valid offline payment amount.'))
  }

  const invoice = await getInvoiceSettlementContext(invoiceId)
  if (!invoice) {
    redirect('/admin/invoicing?error=' + encodeURIComponent('Invoice not found.'))
  }

  if (invoice.status === 'paid') {
    redirect(`/admin/invoicing/${invoice.id}?success=${encodeURIComponent('That invoice is already marked paid.')}`)
  }

  if (amount !== Number(invoice.total)) {
    redirect(`/admin/invoicing/${invoice.id}?error=${encodeURIComponent('Partial offline payments are not supported in the current invoice model. Record the exact invoice total or use a journal-only entry outside the invoice flow.')}`)
  }

  const { cashAccount, arAccount } = await getFinanceAccounts()
  if (cashAccount && arAccount) {
    await createJournalEntryForLines({
      description: `Offline payment recorded for ${invoice.invoiceNumber}`,
      reference: invoice.invoiceNumber,
      createdBy: session.user.id,
      lines: [
        { accountId: cashAccount.id, debit: amount.toFixed(2), credit: '0', description: 'Offline payment received' },
        { accountId: arAccount.id, debit: '0', credit: amount.toFixed(2), description: 'AR reduction' },
      ],
    })
  }

  await logActivityEvent({
    entityType: 'invoice',
    entityId: invoice.id,
    actorUserId: session.user.id,
    kind: 'invoice_offline_payment_recorded',
    title: 'Offline payment recorded',
    body: `$${amount.toFixed(2)} recorded against ${invoice.invoiceNumber}. ${note}`.trim(),
    metadata: { amount, note },
  })

  await applyInvoicePaid(invoice.id, {
    actorUserId: session.user.id,
    paymentReference: note,
    journalReference: invoice.invoiceNumber,
    skipJournalEntry: true,
  })

  redirect(`/admin/invoicing/${invoice.id}?success=${encodeURIComponent('Offline payment recorded.')}`)
}

export async function createInvoiceAdjustment(formData: FormData) {
  const session = await requireAdminOrStaff()
  const invoiceId = (formData.get('invoiceId') as string) || ''
  const adjustmentType = (formData.get('adjustmentType') as string) || 'credit_memo'
  const note = (formData.get('note') as string) || null
  const amountRaw = formData.get('amount') as string
  const amount = Number(amountRaw)

  const [invoice] = await db
    .select({
      id: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      total: invoices.total,
      status: invoices.status,
    })
    .from(invoices)
    .where(eq(invoices.id, invoiceId))
    .limit(1)

  if (!invoice) {
    redirect('/admin/invoicing?error=' + encodeURIComponent('Invoice not found.'))
  }

  const effectiveAmount = adjustmentType === 'void' ? Number(invoice.total) : amount
  if (!Number.isFinite(effectiveAmount) || effectiveAmount <= 0) {
    redirect(`/admin/invoicing/${invoice.id}?error=${encodeURIComponent('Enter a valid adjustment amount.')}`)
  }

  const { arAccount, revenueAccount, expenseAccount } = await getFinanceAccounts()
  if (arAccount && (revenueAccount || expenseAccount)) {
    const contraAccountId = adjustmentType === 'write_off'
      ? (expenseAccount?.id ?? revenueAccount?.id)
      : (revenueAccount?.id ?? expenseAccount?.id)

    if (contraAccountId) {
      const lines = adjustmentType === 'write_off'
        ? [
            { accountId: contraAccountId, debit: effectiveAmount.toFixed(2), credit: '0', description: 'Write-off expense' },
            { accountId: arAccount.id, debit: '0', credit: effectiveAmount.toFixed(2), description: 'AR reduction' },
          ]
        : [
            { accountId: contraAccountId, debit: effectiveAmount.toFixed(2), credit: '0', description: adjustmentType === 'credit_memo' ? 'Credit memo' : 'Invoice void' },
            { accountId: arAccount.id, debit: '0', credit: effectiveAmount.toFixed(2), description: 'AR reduction' },
          ]

      await createJournalEntryForLines({
        description: `${adjustmentType.replaceAll('_', ' ')} for ${invoice.invoiceNumber}`,
        reference: invoice.invoiceNumber,
        createdBy: session.user.id,
        lines,
      })
    }
  }

  await logActivityEvent({
    entityType: 'invoice',
    entityId: invoice.id,
    actorUserId: session.user.id,
    kind: `invoice_${adjustmentType}`,
    title: adjustmentType === 'credit_memo' ? 'Credit memo created' : adjustmentType === 'write_off' ? 'Invoice written off' : 'Invoice voided',
    body: `${invoice.invoiceNumber} ${adjustmentType.replaceAll('_', ' ')} for $${effectiveAmount.toFixed(2)}.${note ? ` ${note}` : ''}`,
    metadata: { adjustmentType, amount: effectiveAmount, note },
  })

  revalidatePath(`/admin/invoicing/${invoice.id}`)
  revalidatePath('/admin/accounts/journal')
  redirect(`/admin/invoicing/${invoice.id}?success=${encodeURIComponent('Invoice adjustment recorded.')}`)
}

export async function createPublicPaymentIntent(token: string, paymentMethod: CustomerPaymentMethod) {
  const invoiceId = resolveInvoiceIdFromPublicToken(token)
  if (!invoiceId) throw new Error('Invalid payment link')
  return _createPaymentIntent(invoiceId, paymentMethod, null)
}

export async function createPaymentIntent(invoiceId: string, paymentMethod: CustomerPaymentMethod) {
  const session = await requireAuth()
  return _createPaymentIntent(invoiceId, paymentMethod, session)
}

async function _createPaymentIntent(
  invoiceId: string,
  paymentMethod: CustomerPaymentMethod,
  session: Awaited<ReturnType<typeof requireAuth>> | null,
) {
  const invoice = await getInvoiceSettlementContext(invoiceId)
  if (!invoice) throw new Error('Invoice not found')
  if (!isInvoicePayable(invoice.status)) throw new Error('Invoice is not payable')

  if (session) {
    const roles = session.user.roles ?? [session.user.role]
    const isAdminOrStaff = roles.some(role => role === 'admin' || role === 'staff')
    if (!isAdminOrStaff && invoice.accountUserId !== session.user.id) {
      throw new Error('Unauthorized')
    }
  }

  const baseAmountCents = Math.round(Number(invoice.total) * 100)
  const breakdown = getCustomerPaymentBreakdown(baseAmountCents, paymentMethod)

  const paymentIntent = await stripe.paymentIntents.create({
    amount: breakdown.totalAmountCents,
    currency: 'usd',
    metadata: {
      invoiceId,
      paymentMethod,
      baseAmountCents: String(baseAmountCents),
      processingFeeCents: String(breakdown.processingFeeCents),
    },
    payment_method_types: [paymentMethod],
    ...(paymentMethod === 'us_bank_account'
      ? {
          payment_method_options: {
            us_bank_account: {
              financial_connections: { permissions: ['payment_method'] },
            },
          },
        }
      : {}),
  })

  await db.update(invoices).set({ stripePaymentIntentId: paymentIntent.id }).where(eq(invoices.id, invoiceId))

  return {
    clientSecret: paymentIntent.client_secret,
    amount: breakdown.totalAmount,
    processingFee: breakdown.processingFee,
  }
}
