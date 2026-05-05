import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { customerAccounts, invoiceItems, invoices, orderItems, orders, products } from '@/db/schema'

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
    total: Number(invoice.total),
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
  }
}
