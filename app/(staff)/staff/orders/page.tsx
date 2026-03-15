import { db } from '@/db'
import { orders, customerAccounts } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatDate } from '@/lib/utils'
import { formatStatusLabel, orderStatusVariant, shippingStatusVariant } from '@/lib/orders/status'
import { isMissingShippingStatusColumn } from '@/lib/orders/shipping-fallback'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { BulkOrderStatusForm } from '@/components/orders/BulkOrderStatusForm'

export default async function StaffOrdersPage() {
  let allOrders: Array<{
    id: string
    total: string
    status: 'pending' | 'confirmed' | 'fulfilled' | 'cancelled'
    shippingStatus: 'not_scheduled' | 'scheduled' | 'out_for_delivery' | 'delivered' | 'issue'
    orderType: 'paid' | 'sample'
    createdAt: Date
    notes: string | null
    companyName: string | null
  }> = []

  try {
    allOrders = await db
      .select({
        id: orders.id,
        total: orders.total,
        status: orders.status,
        shippingStatus: orders.shippingStatus,
        orderType: orders.orderType,
        createdAt: orders.createdAt,
        notes: orders.notes,
        companyName: customerAccounts.companyName,
      })
      .from(orders)
      .leftJoin(customerAccounts, eq(orders.customerId, customerAccounts.id))
      .orderBy(desc(orders.createdAt))
  } catch (error) {
    if (!isMissingShippingStatusColumn(error)) throw error

    allOrders = await db
      .select({
        id: orders.id,
        total: orders.total,
        status: orders.status,
        orderType: orders.orderType,
        createdAt: orders.createdAt,
        notes: orders.notes,
        companyName: customerAccounts.companyName,
      })
      .from(orders)
      .leftJoin(customerAccounts, eq(orders.customerId, customerAccounts.id))
      .orderBy(desc(orders.createdAt))
      .then(rows => rows.map(row => ({ ...row, shippingStatus: 'not_scheduled' as const })))
  }

  return (
    <div className="p-4 sm:p-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Orders</h1>
          <p className="text-muted-foreground mt-1">{allOrders.length} total orders</p>
        </div>
        <Link href="/staff/orders/new"><Button><Plus className="w-4 h-4 mr-2" />New Order</Button></Link>
      </div>
      <BulkOrderStatusForm
        mode="staff"
        orders={allOrders.map((order) => ({
          id: order.id,
          label: `#${order.id.slice(-8).toUpperCase()} ${order.companyName ?? 'Unknown customer'}`,
        }))}
      />
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full min-w-[860px]">
            <thead className="border-b bg-slate-50">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase">Order #</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase">Customer</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase">Type</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase">Order Status</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase">Shipping</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase">Total</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase">Date</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {allOrders.map(order => (
                <tr key={order.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 text-sm font-mono">#{order.id.slice(-8).toUpperCase()}</td>
                  <td className="px-6 py-4 text-sm font-medium">{order.companyName ?? '-'}</td>
                  <td className="px-6 py-4"><Badge variant="outline">{order.orderType}</Badge></td>
                  <td className="px-6 py-4"><Badge variant={orderStatusVariant[order.status]}>{formatStatusLabel(order.status)}</Badge></td>
                  <td className="px-6 py-4"><Badge variant={shippingStatusVariant[order.shippingStatus]}>{formatStatusLabel(order.shippingStatus)}</Badge></td>
                  <td className="px-6 py-4 text-sm font-semibold">{formatCurrency(order.total)}</td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">{formatDate(order.createdAt)}</td>
                  <td className="px-6 py-4"><Link href={`/staff/orders/${order.id}`}><Button variant="ghost" size="sm">View</Button></Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
