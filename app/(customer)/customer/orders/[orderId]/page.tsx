import { db } from '@/db'
import { orders, orderItems, products, customerAccounts } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { requireRole } from '@/lib/auth/session'
import { notFound } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDate } from '@/lib/utils'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default async function CustomerOrderDetailPage({ params }: { params: { orderId: string } }) {
  const session = await requireRole('customer')

  const [order] = await db
    .select({
      id: orders.id, total: orders.total, status: orders.status, orderType: orders.orderType,
      notes: orders.notes, createdAt: orders.createdAt, customerId: orders.customerId,
    })
    .from(orders)
    .where(eq(orders.id, params.orderId))

  if (!order) notFound()

  // Verify ownership
  const [account] = await db.select({ id: customerAccounts.id }).from(customerAccounts).where(eq(customerAccounts.userId, session.user.id))
  if (!account || order.customerId !== account.id) notFound()

  const items = await db
    .select({
      id: orderItems.id, quantity: orderItems.quantity, unitPrice: orderItems.unitPrice, total: orderItems.total,
      productName: products.name,
    })
    .from(orderItems)
    .leftJoin(products, eq(orderItems.productId, products.id))
    .where(eq(orderItems.orderId, params.orderId))

  const statusColor: Record<string, 'default' | 'success' | 'warning' | 'destructive' | 'info'> = {
    pending: 'warning', confirmed: 'info', fulfilled: 'success', cancelled: 'destructive',
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-4">
        <Link href="/customer/orders"><Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900">Order #{order.id.slice(-8).toUpperCase()}</h1>
          <p className="text-muted-foreground mt-1">{formatDate(order.createdAt)}</p>
        </div>
        <Badge variant={statusColor[order.status]}>{order.status}</Badge>
      </div>

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
                  <td className="px-4 py-3 text-sm font-medium">{item.productName}</td>
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
    </div>
  )
}
