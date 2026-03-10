import { db } from '@/db'
import { orders, customerAccounts } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatDate } from '@/lib/utils'
import Link from 'next/link'
import { Plus } from 'lucide-react'

export default async function StaffOrdersPage() {
  const allOrders = await db
    .select({
      id: orders.id, total: orders.total, status: orders.status, orderType: orders.orderType, createdAt: orders.createdAt, notes: orders.notes,
      companyName: customerAccounts.companyName,
    })
    .from(orders)
    .leftJoin(customerAccounts, eq(orders.customerId, customerAccounts.id))
    .orderBy(desc(orders.createdAt))

  const statusColor: Record<string, 'default' | 'success' | 'warning' | 'destructive' | 'info'> = {
    pending: 'warning', confirmed: 'info', fulfilled: 'success', cancelled: 'destructive',
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Orders</h1>
          <p className="text-muted-foreground mt-1">{allOrders.length} total orders</p>
        </div>
        <Link href="/staff/orders/new"><Button><Plus className="w-4 h-4 mr-2" />New Order</Button></Link>
      </div>
      <Card>
        <CardContent className="p-0">
          <table className="w-full">
            <thead className="border-b bg-slate-50">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase">Order #</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase">Customer</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase">Type</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase">Status</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase">Total</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase">Date</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {allOrders.map(o => (
                <tr key={o.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 text-sm font-mono">#{o.id.slice(-8).toUpperCase()}</td>
                  <td className="px-6 py-4 text-sm font-medium">{o.companyName ?? '—'}</td>
                  <td className="px-6 py-4"><Badge variant="outline">{o.orderType}</Badge></td>
                  <td className="px-6 py-4"><Badge variant={statusColor[o.status]}>{o.status}</Badge></td>
                  <td className="px-6 py-4 text-sm font-semibold">{formatCurrency(o.total)}</td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">{formatDate(o.createdAt)}</td>
                  <td className="px-6 py-4"><Link href={`/staff/orders/${o.id}`}><Button variant="ghost" size="sm">View</Button></Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
