import Stripe from 'stripe'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { customerAccounts, invoiceItems, invoices, orderItems, orders, products } from '@/db/schema'
import { getCustomerPaymentBreakdown, type CustomerPaymentMethod } from '@/lib/stripe/fees'

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-02-25.clover' })
  : null

type InvoiceStripeCheckoutData = {
  appliedMethod: CustomerPaymentMethod | null
  appliedMethodLabel: string | null
  appliedProcessingFee: number | null
  appliedTotal: number | null
  paymentIntentStatus: string | null
  achFee: number
  achTotal: number
  cardFee: number
  cardTotal: number
}

export type InvoiceLineItem = {
  id: string
  description: string
  sku: string | null
  quantity: number
  unitLabel: string
  unitPrice: number
  total: number
}

export type InvoiceDetailData = {
  id: string
  invoiceNumber: string
  status: string
  amount: number
  tax: number
  total: number
  dueDate: Date | null
  paidAt: Date | null
  createdAt: Date
  orderId: string | null
  customerId: string | null
  companyName: string
  customerEmail: string | null
  customerPhone: string | null
  paymentTerms: string | null
  customerAddressLines: string[]
  lineItems: InvoiceLineItem[]
  stripeCheckout: InvoiceStripeCheckoutData
}

function resolveStripePaymentMethod(value: string | null | undefined): CustomerPaymentMethod | null {
  if (value === 'card' || value === 'us_bank_account') return value
  return null
}

function formatStripePaymentMethodLabel(method: CustomerPaymentMethod | null) {
  if (method === 'card') return 'Credit card'
  if (method === 'us_bank_account') return 'ACH'
  return null
}

async function getInvoiceStripeCheckoutData(invoiceId: string, stripePaymentIntentId: string | null, invoiceTotal: number): Promise<InvoiceStripeCheckoutData> {
  const baseAmountCents = Math.round(invoiceTotal * 100)
  const achBreakdown = getCustomerPaymentBreakdown(baseAmountCents, 'us_bank_account')
  const cardBreakdown = getCustomerPaymentBreakdown(baseAmountCents, 'card')
  const fallback: InvoiceStripeCheckoutData = {
    appliedMethod: null,
    appliedMethodLabel: null,
    appliedProcessingFee: null,
    appliedTotal: null,
    paymentIntentStatus: null,
    achFee: Number(achBreakdown.processingFee),
    achTotal: Number(achBreakdown.totalAmount),
    cardFee: Number(cardBreakdown.processingFee),
    cardTotal: Number(cardBreakdown.totalAmount),
  }

  if (!stripe || !stripePaymentIntentId) return fallback

  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(stripePaymentIntentId)
    if (paymentIntent.metadata?.invoiceId !== invoiceId) return fallback

    const method = resolveStripePaymentMethod(
      paymentIntent.metadata?.paymentMethod ?? paymentIntent.payment_method_types?.[0] ?? null,
    )
    const status = paymentIntent.status ?? null

    if (!method || status === 'canceled' || status === 'requires_payment_method') {
      return { ...fallback, paymentIntentStatus: status }
    }

    const metadataFeeValue = paymentIntent.metadata?.processingFeeCents?.trim() ?? ''
    const metadataFeeCents = metadataFeeValue ? Number(metadataFeeValue) : Number.NaN
    const processingFeeCents = Number.isFinite(metadataFeeCents)
      ? metadataFeeCents
      : Math.max(paymentIntent.amount - baseAmountCents, 0)

    return {
      ...fallback,
      appliedMethod: method,
      appliedMethodLabel: formatStripePaymentMethodLabel(method),
      appliedProcessingFee: processingFeeCents / 100,
      appliedTotal: paymentIntent.amount / 100,
      paymentIntentStatus: status,
    }
  } catch {
    return fallback
  }
}

export async function getInvoiceDetailData(invoiceId: string): Promise<InvoiceDetailData | null> {
  const [invoice] = await db
    .select({
      id: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      amount: invoices.amount,
      tax: invoices.tax,
      total: invoices.total,
      status: invoices.status,
      dueDate: invoices.dueDate,
      paidAt: invoices.paidAt,
      createdAt: invoices.createdAt,
      orderId: invoices.orderId,
      stripePaymentIntentId: invoices.stripePaymentIntentId,
      customerId: customerAccounts.id,
      companyName: customerAccounts.companyName,
      customerEmail: customerAccounts.email,
      customerPhone: customerAccounts.phone,
      paymentTerms: customerAccounts.paymentTerms,
      orderPaymentTerms: orders.paymentTerms,
      address: customerAccounts.address,
      city: customerAccounts.city,
      state: customerAccounts.state,
      zip: customerAccounts.zip,
    })
    .from(invoices)
    .leftJoin(customerAccounts, eq(invoices.customerId, customerAccounts.id))
    .leftJoin(orders, eq(invoices.orderId, orders.id))
    .where(eq(invoices.id, invoiceId))
    .limit(1)

  if (!invoice) return null

  const invoiceTotal = Number(invoice.total)
  const stripeCheckout = await getInvoiceStripeCheckoutData(invoice.id, invoice.stripePaymentIntentId, invoiceTotal)

  let lineItems: InvoiceLineItem[] = await db
    .select({
      id: invoiceItems.id,
      description: invoiceItems.description,
      sku: invoiceItems.sku,
      quantity: invoiceItems.quantity,
      unit: invoiceItems.unit,
      unitPrice: invoiceItems.unitPrice,
      total: invoiceItems.total,
    })
    .from(invoiceItems)
    .where(eq(invoiceItems.invoiceId, invoice.id))
    .then((rows) =>
      rows.map((row) => ({
        id: row.id,
        description: row.description,
        sku: row.sku ?? null,
        quantity: Number(row.quantity),
        unitLabel: row.unit,
        unitPrice: Number(row.unitPrice),
        total: Number(row.total),
      })),
    )

  if (lineItems.length === 0 && invoice.orderId) {
    lineItems = await db
      .select({
        id: orderItems.id,
        productName: products.name,
        sku: products.sku,
        quantity: orderItems.quantity,
        unit: orderItems.unit,
        unitPrice: orderItems.unitPrice,
        total: orderItems.total,
      })
      .from(orderItems)
      .leftJoin(products, eq(orderItems.productId, products.id))
      .leftJoin(orders, eq(orderItems.orderId, orders.id))
      .where(eq(orderItems.orderId, invoice.orderId))
      .then((rows) =>
        rows.map((row) => ({
          id: row.id,
          description: row.productName ?? 'Product',
          sku: row.sku ?? null,
          quantity: Number(row.quantity),
          unitLabel: row.unit === 'bottle' ? 'Bottle' : 'Case',
          unitPrice: Number(row.unitPrice),
          total: Number(row.total),
        })),
      )
  }

  if (lineItems.length === 0) {
    lineItems = [
      {
        id: `${invoice.id}-summary`,
        description: invoice.orderId ? 'Order total' : 'Invoice charge',
        sku: null,
        quantity: 1,
        unitLabel: 'Service',
        unitPrice: Number(invoice.amount),
        total: Number(invoice.amount),
      },
    ]
  }

  const customerAddressLines = [
    invoice.address,
    [invoice.city, invoice.state, invoice.zip].filter(Boolean).join(', ') || null,
  ].filter(Boolean) as string[]

  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    status: invoice.status,
    amount: Number(invoice.amount),
    tax: Number(invoice.tax),
    total: invoiceTotal,
    dueDate: invoice.dueDate ? new Date(invoice.dueDate) : null,
    paidAt: invoice.paidAt ? new Date(invoice.paidAt) : null,
    createdAt: new Date(invoice.createdAt),
    orderId: invoice.orderId,
    customerId: invoice.customerId,
    companyName: invoice.companyName ?? 'Customer account',
    customerEmail: invoice.customerEmail,
    customerPhone: invoice.customerPhone,
    paymentTerms: invoice.orderPaymentTerms ?? invoice.paymentTerms,
    customerAddressLines,
    lineItems,
    stripeCheckout,
  }
}
