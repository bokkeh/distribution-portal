import { db } from '@/db'
import { orders, invoices, customerAccounts, inventory, products, wholesaleAccountRequests, tastingReports, tastings, scheduledSmsJobs } from '@/db/schema'
import { eq, sql, desc, and, gte } from 'drizzle-orm'
import KpiCard from '@/components/dashboard/KpiCard'
import { DollarSign, ShoppingCart, Users, MessageSquare, AlertTriangle, HeartPulse, ClipboardList } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatDate } from '@/lib/utils'
import { getSmsInboxSummary } from '@/lib/inbox/summary'
import Link from 'next/link'
import { getSystemHealthSnapshot } from '@/lib/ops/system-health'

export default async function AdminDashboard() {
  const [
    totalRevenue,
    totalOrders,
    totalCustomers,
    lowStockItems,
    recentOrders,
    outstandingInvoices,
    smsInboxSummary,
    wholesaleRequestsCount,
    missingTastingReports,
    failedJobs,
    systemHealth,
  ] = await Promise.all([
    db.select({ total: sql<string>`COALESCE(SUM(total), 0)` }).from(invoices).where(eq(invoices.status, 'paid')),
    db.select({ count: sql<number>`COUNT(*)` }).from(orders),
    db.select({ count: sql<number>`COUNT(*)` }).from(customerAccounts),
    db.select({ count: sql<number>`COUNT(*)` }).from(inventory).where(sql`quantity_paid <= reorder_level`),
    db.select({ id: orders.id, total: orders.total, status: orders.status, orderType: orders.orderType, createdAt: orders.createdAt })
      .from(orders).orderBy(desc(orders.createdAt)).limit(5),
    db.select({ total: sql<string>`COALESCE(SUM(total), 0)` }).from(invoices).where(eq(invoices.status, 'sent')),
    getSmsInboxSummary(),
    db.select({ count: sql<number>`COUNT(*)` }).from(wholesaleAccountRequests),
    db.select({ count: sql<number>`COUNT(*)` })
      .from(tastings)
      .leftJoin(tastingReports, eq(tastings.id, tastingReports.tastingId))
      .where(and(eq(tastings.status, 'completed'), sql`${tastingReports.id} is null`)),
    db.select({ count: sql<number>`COUNT(*)` }).from(scheduledSmsJobs).where(eq(scheduledSmsJobs.status, 'failed')),
    getSystemHealthSnapshot(),
  ])

  const statusColor: Record<string, 'default' | 'success' | 'warning' | 'destructive' | 'info'> = {
    pending: 'warning',
    confirmed: 'info',
    fulfilled: 'success',
    cancelled: 'destructive',
  }

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Welcome back to the AHAWC Distribution Portal</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
        <KpiCard
          title="Total Revenue"
          value={formatCurrency(totalRevenue[0]?.total ?? '0')}
          icon={DollarSign}
          iconColor="text-green-600"
        />
        <KpiCard
          title="Total Orders"
          value={String(totalOrders[0]?.count ?? 0)}
          icon={ShoppingCart}
          iconColor="text-blue-600"
        />
        <KpiCard
          title="Active Customers"
          value={String(totalCustomers[0]?.count ?? 0)}
          icon={Users}
          iconColor="text-purple-600"
        />
        <KpiCard
          title="Low Stock Items"
          value={String(lowStockItems[0]?.count ?? 0)}
          change={Number(lowStockItems[0]?.count) > 0 ? 'Needs attention' : 'All good'}
          changeType={Number(lowStockItems[0]?.count) > 0 ? 'negative' : 'positive'}
          icon={AlertTriangle}
          iconColor="text-orange-600"
        />
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
              <Link href="/admin/inbox" className="text-xs font-medium text-primary hover:underline">
                Open inbox
              </Link>
            </div>
          </CardContent>
        </Card>
        <KpiCard
          title="System Health"
          value={String((systemHealth.migrationHistoryState === 'tracked' ? systemHealth.pendingMigrations.length : 0) + systemHealth.missingTables.length + systemHealth.missingColumns.length)}
          change={
            systemHealth.migrationHistoryState === 'tracked'
              ? systemHealth.pendingMigrations.length ? `${systemHealth.pendingMigrations.length} migration(s) pending` : 'No migration gap detected'
              : 'Migration history untracked'
          }
          changeType={(systemHealth.migrationHistoryState === 'tracked' ? systemHealth.pendingMigrations.length : 0) ? 'negative' : 'positive'}
          icon={HeartPulse}
          iconColor="text-rose-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Orders */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Recent Orders</CardTitle>
            <Link href="/admin/invoicing" className="text-xs text-primary hover:underline">View all</Link>
          </CardHeader>
          <CardContent>
            {recentOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No orders yet</p>
            ) : (
              <div className="space-y-3">
                {recentOrders.map((order) => (
                  <div key={order.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <p className="text-sm font-medium">Order #{order.id.slice(-8).toUpperCase()}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(order.createdAt)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={statusColor[order.status] ?? 'default'}>{order.status}</Badge>
                      <span className="text-sm font-semibold">{formatCurrency(order.total)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Outstanding Invoices */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Outstanding Invoices</CardTitle>
            <Link href="/admin/invoicing" className="text-xs text-primary hover:underline">View all</Link>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <p className="text-3xl font-bold text-orange-600">{formatCurrency(outstandingInvoices[0]?.total ?? '0')}</p>
                <p className="text-sm text-muted-foreground mt-1">Awaiting payment</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Approvals And Follow-Up</CardTitle>
            <Link href="/admin/attention" className="text-xs text-primary hover:underline">Open queue</Link>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-slate-900">New wholesale requests</p>
                <p className="text-xs text-slate-500">Review pending account submissions</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-slate-950">{wholesaleRequestsCount[0]?.count ?? 0}</p>
                <Link href="/admin/wholesale-requests" className="text-xs text-primary hover:underline">Open requests</Link>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-slate-900">Missing tasting reports</p>
                <p className="text-xs text-slate-500">Completed tastings still missing submission</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-slate-950">{missingTastingReports[0]?.count ?? 0}</p>
                <Link href="/admin/tastings" className="text-xs text-primary hover:underline">Open tastings</Link>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-slate-900">Failed background jobs</p>
                <p className="text-xs text-slate-500">Scheduled texting and workflow failures</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-slate-950">{failedJobs[0]?.count ?? 0}</p>
                <Link href="/admin/jobs" className="text-xs text-primary hover:underline">Open jobs</Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
