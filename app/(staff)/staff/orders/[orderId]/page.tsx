import { db } from '@/db'
import { orders, orderItems, products, customerAccounts } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { OrderStatusBadge } from '@/components/orders/OrderStatusBadge'
import { CustomerRecordLink } from '@/components/crm/CustomerRecordLink'
import { Button } from '@/components/ui/button'
import { ConfirmSubmitButton } from '@/components/ui/confirm-submit-button'
import { formatCurrency, formatDate } from '@/lib/utils'
import { formatStatusLabel } from '@/lib/orders/status'
import { updateOrderShippingStatus, updateOrderStatus } from '@/actions/orders'
import { formatPaymentTerms } from '@/lib/orders/payment-terms'
import { isMissingShippingStatusColumn } from '@/lib/orders/shipping-fallback'
import { describePricingSource } from '@/lib/pricing/geographic'
import Link from 'next/link'
import { ArrowLeft, Download } from 'lucide-react'

const shippingStatuses = ['not_scheduled', 'scheduled', 'out_for_delivery', 'delivered', 'issue'] as const

export default async function OrderDetailPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params

  let order:
    | {
        id: string
        total: string
        subtotal: string
        tax: string
        status: 'pending' | 'confirmed' | 'fulfilled' | 'cancelled'
        shippingStatus: 'not_scheduled' | 'scheduled' | 'out_for_delivery' | 'delivered' | 'issue'
        orderType: 'paid' | 'sample'
        paymentStatus: string
        paymentTerms: string | null
        notes: string | null
        createdAt: Date
        customerId: string
        companyName: string | null
      }
    | undefined

  try {
    ;[order] = await db
      .select({
        id: orders.id,
        total: orders.total,
        subtotal: orders.subtotal,
        tax: orders.tax,
        status: orders.status,
        shippingStatus: orders.shippingStatus,
        orderType: orders.orderType,
        paymentStatus: orders.paymentStatus,
        paymentTerms: orders.paymentTerms,
        notes: orders.notes,
        createdAt: orders.createdAt,
        customerId: orders.customerId,
        companyName: customerAccounts.companyName,
      })
      .from(orders)
      .leftJoin(customerAccounts, eq(orders.customerId, customerAccounts.id))
      .where(eq(orders.id, orderId))
  } catch (error) {
    if (!isMissingShippingStatusColumn(error)) throw error

    ;[order] = await db
      .select({
        id: orders.id,
        total: orders.total,
        subtotal: orders.subtotal,
        tax: orders.tax,
        status: orders.status,
        orderType: orders.orderType,
        paymentTerms: customerAccounts.paymentTerms,
        notes: orders.notes,
        createdAt: orders.createdAt,
        customerId: orders.customerId,
        companyName: customerAccounts.companyName,
      })
      .from(orders)
      .leftJoin(customerAccounts, eq(orders.customerId, customerAccounts.id))
      .where(eq(orders.id, orderId))
      .then(rows => rows.map(row => ({ ...row, paymentStatus: 'not_applicable', shippingStatus: 'not_scheduled' as const })))
  }

  if (!order) notFound()

  const items = await db
    .select({
      id: orderItems.id,
      quantity: orderItems.quantity,
      unit: orderItems.unit,
      unitPrice: orderItems.unitPrice,
      total: orderItems.total,
      pricingSource: orderItems.pricingSource,
      productName: products.name,
      productSku: products.sku,
    })
    .from(orderItems)
    .leftJoin(products, eq(orderItems.productId, products.id))
    .where(eq(orderItems.orderId, orderId))

  const nextStatus: Record<string, 'confirmed' | 'fulfilled' | 'cancelled'> = {
    pending: 'confirmed',
    confirmed: 'fulfilled',
  }

  return (
    <div className="p-8 space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <Link href="/staff/orders"><Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900">Order #{order.id.slice(-8).toUpperCase()}</h1>
          <p className="text-muted-foreground mt-1">
            <CustomerRecordLink accountId={order.customerId} name={order.companyName ?? 'Unknown customer'} portal="staff" /> · {formatDate(order.createdAt)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <OrderStatusBadge kind="payment" status={order.paymentStatus} />
          <OrderStatusBadge kind="order" status={order.status} />
          <OrderStatusBadge kind="shipping" status={order.shippingStatus} />
          <a href={`/api/orders/${order.id}/pdf`} target="_blank" rel="noopener noreferrer">
            <Button type="button" variant="outline" size="sm"><Download className="w-4 h-4 mr-2" />Download PDF</Button>
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader><CardTitle>Order Items</CardTitle></CardHeader>
          <CardContent className="p-0">
            <table className="w-full">
              <thead className="border-b bg-slate-50">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Product</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Qty</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Unit Price</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map(item => (
                  <tr key={item.id}>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium">{item.productName}</p>
                      <p className="text-xs text-muted-foreground">{item.productSku}</p>
                      {item.pricingSource ? (
                        <p className="text-[11px] text-slate-500">{describePricingSource(item.pricingSource)}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-sm text-right">{item.quantity} {item.unit}{item.quantity === '1' ? '' : 's'}</td>
                    <td className="px-4 py-3 text-sm text-right">{formatCurrency(item.unitPrice)}</td>
                    <td className="px-4 py-3 text-sm font-medium text-right">{formatCurrency(item.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t">
                  <td colSpan={3} className="px-4 py-3 text-sm font-bold text-right">Total</td>
                  <td className="px-4 py-3 text-sm font-bold text-right">{formatCurrency(order.total)}</td>
                </tr>
              </tfoot>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Tracking</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm space-y-2">
              <div className="flex justify-between"><span className="text-muted-foreground">Type</span><Badge variant="outline">{order.orderType}</Badge></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Payment</span><OrderStatusBadge kind="payment" status={order.paymentStatus} /></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Order Status</span><OrderStatusBadge kind="order" status={order.status} /></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Shipping</span><OrderStatusBadge kind="shipping" status={order.shippingStatus} /></div>
              <div className="flex justify-between gap-3"><span className="text-muted-foreground">Payment Terms</span><span className="text-right font-medium">{formatPaymentTerms(order.paymentTerms)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Total</span><span className="font-bold">{formatCurrency(order.total)}</span></div>
            </div>
            <form action={updateOrderShippingStatus.bind(null, order.id)} className="space-y-2">
              <label htmlFor="shippingStatus" className="text-sm font-medium text-slate-900">Shipping Status</label>
              <select id="shippingStatus" name="shippingStatus" defaultValue={order.shippingStatus} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                {shippingStatuses.map(status => (
                  <option key={status} value={status}>{formatStatusLabel(status)}</option>
                ))}
              </select>
              <Button type="submit" variant="outline" className="w-full">Update Shipping</Button>
            </form>
            {order.notes && (
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Notes</p>
                <p className="text-sm">{order.notes}</p>
              </div>
            )}
            {nextStatus[order.status] && (
              <form action={updateOrderStatus.bind(null, order.id, nextStatus[order.status])}>
                <Button className="w-full" type="submit">
                  Mark as {formatStatusLabel(nextStatus[order.status])}
                </Button>
              </form>
            )}
            {order.status === 'fulfilled' && (
              <form action={updateOrderStatus.bind(null, order.id, 'confirmed')}>
                <ConfirmSubmitButton variant="outline" className="w-full" title="Unfulfill this order?" description="The order will move back to confirmed status." confirmLabel="Unfulfill Order">Unfulfill Order</ConfirmSubmitButton>
              </form>
            )}
            {order.status !== 'cancelled' && (
              <form action={updateOrderStatus.bind(null, order.id, 'cancelled')}>
                <ConfirmSubmitButton
                  variant="destructive"
                  className="w-full"
                  title="Cancel this order?"
                  description={order.status === 'pending'
                    ? 'The order status will be set to cancelled.'
                    : `This order is already ${order.status}. Cancelling will remove it from revenue totals and keep it visible here as a cancelled record.`}
                  confirmLabel="Cancel Order"
                >
                  Cancel Order
                </ConfirmSubmitButton>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
