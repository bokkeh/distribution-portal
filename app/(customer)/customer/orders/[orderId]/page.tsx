import { db } from '@/db'
import { customerAccounts, deliveries, deliveryStops, orderItems, orders, products } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { requireRole } from '@/lib/auth/session'
import { notFound } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { OrderStatusBadge } from '@/components/orders/OrderStatusBadge'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDate } from '@/lib/utils'
import { formatPaymentTerms } from '@/lib/orders/payment-terms'
import { isMissingShippingStatusColumn } from '@/lib/orders/shipping-fallback'
import { describePricingSource } from '@/lib/pricing/geographic'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { reorderCustomerOrder } from '@/actions/orders'

export default async function CustomerOrderDetailPage({ params }: { params: Promise<{ orderId: string }> }) {
  const session = await requireRole('customer')
  const { orderId } = await params

  let order:
    | {
        id: string
        total: string
        status: 'pending' | 'confirmed' | 'fulfilled' | 'cancelled'
        orderType: 'paid' | 'sample'
        paymentStatus: string
        shippingStatus: 'not_scheduled' | 'scheduled' | 'out_for_delivery' | 'delivered' | 'issue'
        paymentTerms: string | null
        notes: string | null
        createdAt: Date
        customerId: string
      }
    | undefined

  try {
    ;[order] = await db
      .select({
        id: orders.id, total: orders.total, status: orders.status, orderType: orders.orderType, paymentStatus: orders.paymentStatus,
        shippingStatus: orders.shippingStatus, paymentTerms: orders.paymentTerms, notes: orders.notes, createdAt: orders.createdAt, customerId: orders.customerId,
      })
      .from(orders)
      .where(eq(orders.id, orderId))
  } catch (error) {
    if (!isMissingShippingStatusColumn(error)) throw error

    ;[order] = await db
      .select({
        id: orders.id, total: orders.total, status: orders.status, orderType: orders.orderType,
        paymentTerms: customerAccounts.paymentTerms, notes: orders.notes, createdAt: orders.createdAt, customerId: orders.customerId,
      })
      .from(orders)
      .leftJoin(customerAccounts, eq(orders.customerId, customerAccounts.id))
      .where(eq(orders.id, orderId))
      .then(rows => rows.map(row => ({ ...row, paymentStatus: 'not_applicable', shippingStatus: 'not_scheduled' as const })))
  }

  if (!order) notFound()

  // Verify ownership
  const [account] = await db.select({ id: customerAccounts.id }).from(customerAccounts).where(eq(customerAccounts.userId, session.user.id))
  if (!account || order.customerId !== account.id) notFound()

  const items = await db
    .select({
      id: orderItems.id, quantity: orderItems.quantity, unitPrice: orderItems.unitPrice, total: orderItems.total, pricingSource: orderItems.pricingSource,
      productName: products.name,
    })
    .from(orderItems)
    .leftJoin(products, eq(orderItems.productId, products.id))
    .where(eq(orderItems.orderId, orderId))

  const [deliveryStop] = await db
    .select({
      deliveryId: deliveryStops.deliveryId,
      stopStatus: deliveryStops.status,
      completedAt: deliveryStops.completedAt,
      deliveryStatus: deliveries.status,
      weekStartDate: deliveries.weekStartDate,
    })
    .from(deliveryStops)
    .leftJoin(deliveries, eq(deliveryStops.deliveryId, deliveries.id))
    .where(eq(deliveryStops.orderId, orderId))

  const supportSmsNumber = process.env.TELNYX_FROM_NUMBER

  const trackingEvents = [
    {
      label: 'Order received',
      description: 'We received your order and added it to the portal.',
      active: true,
      completedAt: order.createdAt,
    },
    {
      label: 'Order processed',
      description: order.status === 'confirmed' || order.status === 'fulfilled'
        ? 'Your order has been reviewed and confirmed.'
        : 'Awaiting review and confirmation.',
      active: order.status === 'confirmed' || order.status === 'fulfilled',
      completedAt: order.status === 'confirmed' || order.status === 'fulfilled' ? order.createdAt : null,
    },
    {
      label: 'Delivery scheduled',
      description: order.shippingStatus === 'scheduled' || order.shippingStatus === 'out_for_delivery' || order.shippingStatus === 'delivered'
        ? `Delivery is scheduled${deliveryStop?.weekStartDate ? ` for week of ${deliveryStop.weekStartDate}` : ''}.`
        : 'Delivery has not been scheduled yet.',
      active: order.shippingStatus === 'scheduled' || order.shippingStatus === 'out_for_delivery' || order.shippingStatus === 'delivered',
      completedAt: deliveryStop?.weekStartDate ? new Date(String(deliveryStop.weekStartDate)) : null,
    },
    {
      label: 'Out for delivery',
      description: order.shippingStatus === 'out_for_delivery' || order.shippingStatus === 'delivered'
        ? 'Your order is on the route now.'
        : 'The driver has not started this stop yet.',
      active: order.shippingStatus === 'out_for_delivery' || order.shippingStatus === 'delivered',
      completedAt: null,
    },
    {
      label: order.shippingStatus === 'issue' ? 'Delivery issue' : 'Delivered',
      description: order.shippingStatus === 'delivered'
        ? 'Delivery was completed successfully.'
        : order.shippingStatus === 'issue'
          ? 'There is an issue with this delivery. Our team will follow up.'
          : 'Awaiting final delivery confirmation.',
      active: order.shippingStatus === 'delivered' || order.shippingStatus === 'issue',
      completedAt: deliveryStop?.completedAt ?? null,
    },
  ]

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-4">
        <Link href="/customer/orders"><Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900">Order #{order.id.slice(-8).toUpperCase()}</h1>
          <p className="text-muted-foreground mt-1">{formatDate(order.createdAt)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <OrderStatusBadge kind="payment" status={order.paymentStatus} />
          <OrderStatusBadge kind="order" status={order.status} />
          <OrderStatusBadge kind="shipping" status={order.shippingStatus} />
          <form action={reorderCustomerOrder.bind(null, order.id)}>
            <Button variant="outline" size="sm" type="submit">Reorder</Button>
          </form>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Order Tracking</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Order Status</p>
              <div className="mt-2"><OrderStatusBadge kind="order" status={order.status} /></div>
            </div>
            <div className="rounded-lg border bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Shipping Status</p>
              <div className="mt-2"><OrderStatusBadge kind="shipping" status={order.shippingStatus} /></div>
            </div>
            <div className="rounded-lg border bg-slate-50 p-4 sm:col-span-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Payment Status</p>
              <div className="mt-2"><OrderStatusBadge kind="payment" status={order.paymentStatus} /></div>
            </div>
            <div className="rounded-lg border bg-slate-50 p-4 sm:col-span-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Payment Terms</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{formatPaymentTerms(order.paymentTerms)}</p>
            </div>
          </div>
          <div className="space-y-3">
            {trackingEvents.map((event, index) => (
              <div key={event.label} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className={`mt-1 h-3 w-3 rounded-full ${event.active ? 'bg-blue-600' : 'bg-slate-300'}`} />
                  {index < trackingEvents.length - 1 ? <div className={`mt-1 h-full w-px ${event.active ? 'bg-blue-200' : 'bg-slate-200'}`} /> : null}
                </div>
                <div className="pb-4">
                  <p className="text-sm font-semibold text-slate-900">{event.label}</p>
                  <p className="text-sm text-muted-foreground">{event.description}</p>
                  {event.completedAt ? (
                    <p className="mt-1 text-xs text-slate-500" suppressHydrationWarning>{formatDate(event.completedAt)}</p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Order Items</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full">
            <thead className="border-b bg-slate-50">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Product</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Qty</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Price</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map(item => (
                <tr key={item.id}>
                  <td className="px-4 py-3 text-sm font-medium">
                    <p>{item.productName}</p>
                    {item.pricingSource ? (
                      <p className="text-[11px] font-normal text-slate-500">{describePricingSource(item.pricingSource)}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-sm text-right">{item.quantity}</td>
                  <td className="px-4 py-3 text-sm text-right">{formatCurrency(item.unitPrice)}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-right">{formatCurrency(item.total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t">
                <td colSpan={3} className="px-4 py-3 font-bold text-right">Total</td>
                <td className="px-4 py-3 font-bold text-right">{formatCurrency(order.total)}</td>
              </tr>
            </tfoot>
          </table>
        </CardContent>
      </Card>

      {order.notes && (
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground mb-1">Notes</p>
            <p className="text-sm">{order.notes}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Need Help?</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          {supportSmsNumber ? (
            <a href={`sms:${supportSmsNumber}`}>
              <Button variant="outline">Text Support</Button>
            </a>
          ) : null}
          <Link href="/customer/profile">
            <Button variant="ghost">Update Delivery Preferences</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
