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

export default async function StaffOrdersPage() {
  let allOrders: Array<{
    id: string
    total: string
    quantity: number
    status: 'pending' | 'confirmed' | 'fulfilled' | 'cancelled'
    shippingStatus: 'not_scheduled' | 'scheduled' | 'out_for_delivery' | 'delivered' | 'issue'
    orderType: 'paid' | 'sample'
    paymentStatus: string
    paymentMethod: string | null
    createdAt: Date
    notes: string | null
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
        paymentMethod: orders.paymentMethod,
        createdAt: orders.createdAt,
        notes: orders.notes,
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
        notes: orders.notes,
        customerId: orders.customerId,
        companyName: customerAccounts.companyName,
      })
      .from(orders)
      .leftJoin(customerAccounts, eq(orders.customerId, customerAccounts.id))
      .orderBy(desc(orders.createdAt))
      .then(rows => rows.map(row => ({ ...row, quantity: 0, paymentStatus: 'not_applicable', paymentMethod: null, shippingStatus: 'not_scheduled' as const })))
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
        <Link href="/staff/orders/new"><Button><Plus className="w-4 h-4 mr-2" />New Order</Button></Link>
      </div>
      <BulkOrderStatusForm
        mode="staff"
        orders={allOrders.map((order) => ({
          id: order.id,
          label: `#${order.id.slice(-8).toUpperCase()} ${order.companyName ?? 'Unknown customer'}`,
        }))}
      />
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <OrdersTable orders={allOrders} portal="staff" />
        </CardContent>
      </Card>
    </div>
  )
}
