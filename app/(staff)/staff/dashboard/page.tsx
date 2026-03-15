import { db } from '@/db'
import { orders, customerAccounts } from '@/db/schema'
import { eq, desc, sql } from 'drizzle-orm'
import { requireAdminOrStaff } from '@/lib/auth/session'
import KpiCard from '@/components/dashboard/KpiCard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDate } from '@/lib/utils'
import { ShoppingCart, Users, Package, MessageSquare } from 'lucide-react'
import { getSmsInboxSummary } from '@/lib/inbox/summary'
import Link from 'next/link'

export default async function StaffDashboard() {
  const session = await requireAdminOrStaff()

  const [totalOrders, totalCustomers, recentOrders, smsInboxSummary] = await Promise.all([
    db.select({ count: sql<number>`COUNT(*)` }).from(orders),
    db.select({ count: sql<number>`COUNT(*)` }).from(customerAccounts),
    db.select({
      id: orders.id, total: orders.total, status: orders.status, orderType: orders.orderType, createdAt: orders.createdAt,
      companyName: customerAccounts.companyName,
    }).from(orders)
      .leftJoin(customerAccounts, eq(orders.customerId, customerAccounts.id))
      .orderBy(desc(orders.createdAt)).limit(8),
    getSmsInboxSummary(),
  ])

  const statusColor: Record<string, 'default' | 'success' | 'warning' | 'destructive' | 'info'> = {
    pending: 'warning', confirmed: 'info', fulfilled: 'success', cancelled: 'destructive',
  }

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Sales Dashboard</h1>
        <p className="text-muted-foreground mt-1">Welcome back, {session.user.name}</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard title="Total Orders" value={String(totalOrders[0]?.count ?? 0)} icon={ShoppingCart} />
        <KpiCard title="Accounts" value={String(totalCustomers[0]?.count ?? 0)} icon={Users} />
        <KpiCard title="My Orders (Today)" value="-" icon={Package} />
        <Card className="border-0 bg-white shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-slate-500">SMS Inbox</p>
                <p className="mt-6 text-4xl font-bold tracking-tight text-slate-950">{smsInboxSummary.totalTexts}</p>
                <p className="mt-2 text-sm font-medium text-slate-500">Total texts logged</p>
              </div>
              <div className="rounded-xl bg-slate-100 p-3 text-emerald-600">
                <MessageSquare className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-6 flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Open Threads</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">{smsInboxSummary.openThreads}</p>
              </div>
              <Link href="/staff/inbox" className="text-xs font-medium text-primary hover:underline">
                Open inbox
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Recent Orders</CardTitle>
          <Link href="/staff/orders/new"><Button size="sm">+ New Order</Button></Link>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full">
            <thead className="border-b bg-slate-50">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase">Customer</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase">Type</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase">Status</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase">Total</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase">Date</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {recentOrders.map(o => (
                <tr key={o.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 text-sm font-medium">{o.companyName ?? '—'}</td>
                  <td className="px-6 py-4"><Badge variant="secondary">{o.orderType}</Badge></td>
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
