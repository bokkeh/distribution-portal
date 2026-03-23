import { db } from '@/db'
import { orders, customerAccounts, orderItems, products } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'
import { requireRole } from '@/lib/auth/session'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDate } from '@/lib/utils'
import { formatStatusLabel, orderStatusVariant, shippingStatusVariant } from '@/lib/orders/status'
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
    shippingStatus: 'not_scheduled' | 'scheduled' | 'out_for_delivery' | 'delivered' | 'issue'
    notes: string | null
    createdAt: Date
  }> = []

  if (account) {
    try {
      myOrders = await db
        .select({
          id: orders.id, total: orders.total, status: orders.status, orderType: orders.orderType,
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
        .then(rows => rows.map(row => ({ ...row, shippingStatus: 'not_scheduled' as const })))
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">My Orders</h1>
        <p className="text-muted-foreground mt-1">{myOrders.length} orders</p>
      </div>

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
