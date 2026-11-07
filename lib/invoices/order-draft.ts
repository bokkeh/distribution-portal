import { randomUUID } from 'crypto'
import { db } from '@/db'
import { invoices, invoiceItems } from '@/db/schema'

// These writes join the order/items batch, so a failed invoice cannot leave an order without one.
export function orderDraftWrites(input: {
  paidAt?: Date | null; paymentStatus?: string; stripePaymentIntentId?: string | null
  orderId: string; customerId: string; orderType: string; subtotal: number; tax: number; total: number
  lines: Array<{ productId: string; quantity: string; unit?: string; unitPrice: string; total: string }>
  products: Map<string, { name: string; sku: string }>
}) {
  if (input.orderType === 'sample') return []
  const invoiceId = randomUUID()
  const extra = Number((input.total - input.subtotal - input.tax).toFixed(2))
  return [
    db.insert(invoices).values({ id: invoiceId, orderId: input.orderId, customerId: input.customerId,
      invoiceNumber: `INV-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${randomUUID().slice(0, 8).toUpperCase()}`,
      amount: (input.total - input.tax).toFixed(2), tax: input.tax.toFixed(2), total: input.total.toFixed(2), status: input.paymentStatus === 'paid' ? 'paid' : 'draft', paidAt: input.paidAt ?? null, stripePaymentIntentId: input.stripePaymentIntentId ?? null }),
    db.insert(invoiceItems).values([
      ...input.lines.map(line => ({ invoiceId, productId: line.productId,
        description: input.products.get(line.productId)?.name ?? 'Product', sku: input.products.get(line.productId)?.sku ?? null,
        quantity: line.quantity, unit: line.unit ?? 'case', unitPrice: line.unitPrice, total: line.total })),
      ...(extra ? [{ invoiceId, productId: null, description: 'Delivery and processing fees', sku: null, quantity: '1', unit: 'service', unitPrice: extra.toFixed(2), total: extra.toFixed(2) }] : []),
    ]),
  ]
}
