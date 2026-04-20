import { db } from '@/db'
import { orders, customerAccounts } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'
import { requireRole } from '@/lib/auth/session'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDate } from '@/lib/utils'
import { formatOrderPaymentStatusLabel, formatStatusLabel, orderPaymentStatusVariant, orderStatusVariant, shippingStatusVariant } from '@/lib/orders/status'
import { isMissingShippingStatusColumn } from '@/lib/orders/shipping-fallback'
import Link from 'next/link'
import { ShoppingCart } from 'lucide-react'
import { reorderCustomerOrder } from '@/actions/orders'
import { EmptyState } from '@/components/ui/empty-state'

export default async function CustomerOrdersPage() {
  const session = await requireRole('customer')

  const [account] = await db.select({ id: customerAccounts.id }).from(customerAccounts).where(eq(customerAccounts.userId, session.user.id))

  let myOrders: Array<{
    id: string
    total: string
    status: 'pending' | 'confirmed' | 'fulfilled' | 'cancelled'
    orderType: 'paid' | 'sample'
    paymentStatus: string
    shippingStatus: 'not_scheduled' | 'scheduled' | 'out_for_delivery' | 'delivered' | 'issue'
    notes: string | null
    createdAt: Date
  }> = []

  if (account) {
    try {
      myOrders = await db
        .select({
          id: orders.id, total: orders.total, status: orders.status, orderType: orders.orderType, paymentStatus: orders.paymentStatus,
          shippingStatus: orders.shippingStatus, notes: orders.notes, createdAt: orders.createdAt,
        })
        .from(orders)
        .where(eq(orders.customerId, account.id))
        .orderBy(desc(orders.createdAt))
    } catch (error) {
      if (!isMissingShippingStatusColumn(error)) throw error

      myOrders = await db
        .select({
          id: orders.id, total: orders.total, status: orders.status, orderType: orders.orderType,
          notes: orders.notes, createdAt: orders.createdAt,
        })
        .from(orders)
        .where(eq(orders.customerId, account.id))
        .orderBy(desc(orders.createdAt))
        .then(rows => rows.map(row => ({ ...row, paymentStatus: 'not_applicable', shippingStatus: 'not_scheduled' as const })))
    }
  }

  const openCount = myOrders.filter(order => order.status === 'pending' || order.status === 'confirmed').length
  const deliveredCount = myOrders.filter(order => order.shippingStatus === 'delivered').length
  const outForDeliveryCount = myOrders.filter(order => order.shippingStatus === 'out_for_delivery').length

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-blue-50">
        <div className="grid gap-6 px-6 py-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8">
          <div className="space-y-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">My Orders</h1>
              <p className="mt-1 text-muted-foreground">Track placed orders, delivery progress, and quick reorder opportunities.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-slate-500">Total orders</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">{myOrders.length}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-slate-500">Open</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">{openCount}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-slate-500">Out for delivery</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">{outForDeliveryCount}</p>
                <p className="mt-1 text-xs text-slate-500">{deliveredCount} delivered</p>
              </div>
            </div>
          </div>

          <Card className="border-slate-200 bg-white/90 shadow-sm">
            <CardContent className="flex h-full flex-col justify-center gap-4 p-6">
              <div>
                <p className="text-sm font-semibold text-slate-900">Need to place another order?</p>
                <p className="mt-1 text-sm text-slate-500">Use the catalog to reorder staples or explore current inventory before you submit.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href="/customer/products"><Button>Browse Products</Button></Link>
                <Link href="/customer/cart"><Button variant="outline">Open Cart</Button></Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {myOrders.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title="No orders yet"
          description="Start by browsing our product catalog."
          action={<Link href="/customer/products"><Button>Browse Products</Button></Link>}
        />
      ) : (
        <div className="space-y-3">
          {myOrders.map(order => (
            <Card key={order.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <p className="font-semibold">Order #{order.id.slice(-8).toUpperCase()}</p>
                      <Badge variant="outline">{order.orderType}</Badge>
                      <Badge variant={orderPaymentStatusVariant[order.paymentStatus] ?? 'secondary'}>{formatOrderPaymentStatusLabel(order.paymentStatus)}</Badge>
                      <Badge variant={orderStatusVariant[order.status]}>{formatStatusLabel(order.status)}</Badge>
                      <Badge variant={shippingStatusVariant[order.shippingStatus]}>{formatStatusLabel(order.shippingStatus)}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{formatDate(order.createdAt)}</p>
                    {order.notes && <p className="text-sm text-muted-foreground">{order.notes}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold">{formatCurrency(order.total)}</p>
                    <div className="mt-1 flex flex-wrap justify-end gap-2">
                      <Link href={`/customer/orders/${order.id}`}>
                        <Button variant="ghost" size="sm">View Details</Button>
                      </Link>
                      <form action={reorderCustomerOrder.bind(null, order.id)}>
                        <Button variant="outline" size="sm" type="submit">Reorder</Button>
                      </form>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
