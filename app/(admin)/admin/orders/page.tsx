import { db } from '@/db'
import { orders, customerAccounts, orderItems } from '@/db/schema'
import { eq, desc, inArray, sql } from 'drizzle-orm'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { isMissingShippingStatusColumn } from '@/lib/orders/shipping-fallback'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { BulkOrderStatusForm } from '@/components/orders/BulkOrderStatusForm'
import { OrdersTable } from '@/components/orders/OrdersTable'
import { PageTabs } from '@/components/ui/PageTabs'
import { AssistedOrdersView } from '@/components/orders/AssistedOrdersView'

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab } = await searchParams
  const defaultTab = tab === 'assisted' ? 'assisted' : 'orders'
  let allOrders: Array<{
    id: string
    total: string
    quantity: number
    status: 'pending' | 'confirmed' | 'fulfilled' | 'cancelled'
    shippingStatus: 'not_scheduled' | 'scheduled' | 'out_for_delivery' | 'delivered' | 'issue'
    orderType: 'paid' | 'sample'
    paymentStatus: string
    createdAt: Date
    customerId: string
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
        paymentStatus: orders.paymentStatus,
        createdAt: orders.createdAt,
        customerId: orders.customerId,
        companyName: customerAccounts.companyName,
      })
      .from(orders)
      .leftJoin(customerAccounts, eq(orders.customerId, customerAccounts.id))
      .orderBy(desc(orders.createdAt))
      .then(rows => rows.map(row => ({ ...row, quantity: 0 })))
  } catch (error) {
    if (!isMissingShippingStatusColumn(error)) throw error

    allOrders = await db
      .select({
        id: orders.id,
        total: orders.total,
        status: orders.status,
        orderType: orders.orderType,
        createdAt: orders.createdAt,
        customerId: orders.customerId,
        companyName: customerAccounts.companyName,
      })
      .from(orders)
      .leftJoin(customerAccounts, eq(orders.customerId, customerAccounts.id))
      .orderBy(desc(orders.createdAt))
      .then(rows => rows.map(row => ({ ...row, quantity: 0, paymentStatus: 'not_applicable', shippingStatus: 'not_scheduled' as const })))
  }

  const orderIds = allOrders.map(order => order.id)
  const quantityRows = orderIds.length > 0
    ? await db
        .select({
          orderId: orderItems.orderId,
          quantity: sql<number>`coalesce(sum(${orderItems.quantity}::numeric), 0)::float`.as('quantity'),
        })
        .from(orderItems)
        .where(inArray(orderItems.orderId, orderIds))
        .groupBy(orderItems.orderId)
    : []

  const quantityByOrderId = new Map(quantityRows.map(row => [row.orderId, Number(row.quantity ?? 0)]))
  allOrders = allOrders.map(order => ({
    ...order,
    quantity: quantityByOrderId.get(order.id) ?? 0,
  }))

  return (
    <div className="p-4 sm:p-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Orders</h1>
          <p className="text-muted-foreground mt-1">{allOrders.length} total orders</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/orders/new"><Button><Plus className="w-4 h-4 mr-2" />New Order</Button></Link>
        </div>
      </div>
      <PageTabs
        ariaLabel="Orders views"
        defaultTab={defaultTab}
        tabs={[{ id: 'orders', label: 'Orders' }, { id: 'assisted', label: 'Assisted Orders' }]}
      >
      <div className="space-y-6">
      <BulkOrderStatusForm
        mode="admin"
        orders={allOrders.map((order) => ({
          id: order.id,
          label: `#${order.id.slice(-8).toUpperCase()} ${order.companyName ?? 'Unknown customer'}`,
        }))}
      />
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <OrdersTable orders={allOrders} />
        </CardContent>
      </Card>
      </div>
      <div className="pt-6">
        <AssistedOrdersView />
      </div>
      </PageTabs>
    </div>
  )
}
