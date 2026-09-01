import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { customerAccounts, invoices, orderItems, orders, products } from '@/db/schema'
import { isMissingShippingStatusColumn } from '@/lib/orders/shipping-fallback'

export type OrderPdfLineItem = {
  id: string
  productName: string
  productSku: string | null
  quantity: string
  unit: string
  unitPrice: string
  total: string
}

export type OrderPdfData = {
  id: string
  status: string
  shippingStatus: string
  orderType: string
  paymentStatus: string
  paymentTerms: string | null
  notes: string | null
  subtotal: string
  tax: string
  total: string
  createdAt: Date
  customerId: string
  companyName: string
  customerEmail: string | null
  customerPhone: string | null
  customerAddressLines: string[]
  linkedInvoiceNumber: string | null
  lineItems: OrderPdfLineItem[]
}

export async function getOrderPdfData(orderId: string): Promise<OrderPdfData | null> {
  let order:
    | {
        id: string
        subtotal: string
        tax: string
        total: string
        status: string
        shippingStatus: string
        orderType: string
        paymentStatus: string
        paymentTerms: string | null
        notes: string | null
        createdAt: Date
        customerId: string
        companyName: string | null
        customerEmail: string | null
        customerPhone: string | null
        address: string | null
        city: string | null
        state: string | null
        zip: string | null
      }
    | undefined

  try {
    ;[order] = await db
      .select({
        id: orders.id,
        subtotal: orders.subtotal,
        tax: orders.tax,
        total: orders.total,
        status: orders.status,
        shippingStatus: orders.shippingStatus,
        orderType: orders.orderType,
        paymentStatus: orders.paymentStatus,
        paymentTerms: orders.paymentTerms,
        notes: orders.notes,
        createdAt: orders.createdAt,
        customerId: orders.customerId,
        companyName: customerAccounts.companyName,
        customerEmail: customerAccounts.email,
        customerPhone: customerAccounts.phone,
        address: customerAccounts.address,
        city: customerAccounts.city,
        state: customerAccounts.state,
        zip: customerAccounts.zip,
      })
      .from(orders)
      .leftJoin(customerAccounts, eq(orders.customerId, customerAccounts.id))
      .where(eq(orders.id, orderId))
  } catch (error) {
    if (!isMissingShippingStatusColumn(error)) throw error

    ;[order] = await db
      .select({
        id: orders.id,
        subtotal: orders.subtotal,
        tax: orders.tax,
        total: orders.total,
        status: orders.status,
        orderType: orders.orderType,
        paymentTerms: customerAccounts.paymentTerms,
        notes: orders.notes,
        createdAt: orders.createdAt,
        customerId: orders.customerId,
        companyName: customerAccounts.companyName,
        customerEmail: customerAccounts.email,
        customerPhone: customerAccounts.phone,
        address: customerAccounts.address,
        city: customerAccounts.city,
        state: customerAccounts.state,
        zip: customerAccounts.zip,
      })
      .from(orders)
      .leftJoin(customerAccounts, eq(orders.customerId, customerAccounts.id))
      .where(eq(orders.id, orderId))
      .then((rows) => rows.map((row) => ({ ...row, paymentStatus: 'not_applicable', shippingStatus: 'not_scheduled' })))
  }

  if (!order) return null

  const items = await db
    .select({
      id: orderItems.id,
      quantity: orderItems.quantity,
      unit: orderItems.unit,
      unitPrice: orderItems.unitPrice,
      total: orderItems.total,
      productName: products.name,
      productSku: products.sku,
    })
    .from(orderItems)
    .leftJoin(products, eq(orderItems.productId, products.id))
    .where(eq(orderItems.orderId, orderId))

  const [linkedInvoice] = await db
    .select({ invoiceNumber: invoices.invoiceNumber })
    .from(invoices)
    .where(eq(invoices.orderId, orderId))
    .limit(1)

  const customerAddressLines = [
    order.address,
    [order.city, order.state, order.zip].filter(Boolean).join(', ') || null,
  ].filter(Boolean) as string[]

  return {
    id: order.id,
    status: order.status,
    shippingStatus: order.shippingStatus,
    orderType: order.orderType,
    paymentStatus: order.paymentStatus,
    paymentTerms: order.paymentTerms,
    notes: order.notes,
    subtotal: order.subtotal,
    tax: order.tax,
    total: order.total,
    createdAt: new Date(order.createdAt),
    customerId: order.customerId,
    companyName: order.companyName ?? 'Unknown customer',
    customerEmail: order.customerEmail,
    customerPhone: order.customerPhone,
    customerAddressLines,
    linkedInvoiceNumber: linkedInvoice?.invoiceNumber ?? null,
    lineItems: items.map((item) => ({
      id: item.id,
      productName: item.productName ?? 'Product',
      productSku: item.productSku ?? null,
      quantity: item.quantity,
      unit: item.unit,
      unitPrice: item.unitPrice,
      total: item.total,
    })),
  }
}
