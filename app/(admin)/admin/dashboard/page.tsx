import { db } from '@/db'
import { orders, invoices, customerAccounts, inventory, wholesaleAccountRequests, tastingReports, tastings, scheduledSmsJobs, deliveries, deliveryStops } from '@/db/schema'
import { eq, sql, desc, and, ne, inArray } from 'drizzle-orm'
import KpiCard from '@/components/dashboard/KpiCard'
import { DollarSign, ShoppingCart, Users, MessageSquare, AlertTriangle, HeartPulse, Truck, Wine } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatDate } from '@/lib/utils'
import { getSmsInboxSummary } from '@/lib/inbox/summary'
import Link from 'next/link'
import { getSystemHealthSnapshot } from '@/lib/ops/system-health'
import { RevenueChart } from '@/components/dashboard/RevenueChart'
import type { MonthlyRevenuePoint } from '@/components/dashboard/RevenueChart'

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
    monthlyRevenue,
    tastingConvStats,
    topAccounts,
    deliveryStats,
  ] = await Promise.all([
    db.select({ total: sql<string>`COALESCE(SUM(total), 0)` }).from(orders).where(ne(orders.status, 'cancelled')),
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
    // Monthly revenue (last 12 months)
    db.select({
      month: sql<string>`TO_CHAR(DATE_TRUNC('month', ${orders.createdAt}), 'Mon YYYY')`,
      monthOrder: sql<string>`DATE_TRUNC('month', ${orders.createdAt})`,
      revenue: sql<string>`COALESCE(SUM(${orders.total}), 0)`,
    })
      .from(orders)
      .where(and(
        ne(orders.status, 'cancelled'),
        sql`${orders.createdAt} >= NOW() - INTERVAL '12 months'`
      ))
      .groupBy(sql`DATE_TRUNC('month', ${orders.createdAt})`)
      .orderBy(sql`DATE_TRUNC('month', ${orders.createdAt})`),
    // Tasting conversion stats
    db.select({
      totalInteractions: sql<number>`COALESCE(SUM(${tastingReports.consumerInteractions}), 0)`,
      totalBottles: sql<number>`COALESCE(SUM(${tastingReports.bottlesSold}), 0)`,
    }).from(tastingReports),
    // Top accounts by total orders
    db.select({
      companyName: customerAccounts.companyName,
      customerId: customerAccounts.id,
      total: sql<string>`COALESCE(SUM(${orders.total}), 0)`,
    })
      .from(customerAccounts)
      .leftJoin(orders, and(eq(orders.customerId, customerAccounts.id), ne(orders.status, 'cancelled')))
      .groupBy(customerAccounts.id, customerAccounts.companyName)
      .orderBy(desc(sql`COALESCE(SUM(${orders.total}), 0)`))
      .limit(5),
    // Delivery completion stats
    (async () => {
      const allDeliveries = await db.select({ id: deliveries.id, status: deliveries.status }).from(deliveries)
      const allDeliveryIds = allDeliveries.map(d => d.id)
      if (allDeliveryIds.length === 0) return { totalStops: 0, deliveredStops: 0 }
      const stopStats = await db.select({
        total: sql<number>`COUNT(*)`,
        delivered: sql<number>`COUNT(*) FILTER (WHERE ${deliveryStops.status} = 'delivered')`,
      })
        .from(deliveryStops)
        .where(inArray(deliveryStops.deliveryId, allDeliveryIds))
      return {
        totalStops: Number(stopStats[0]?.total ?? 0),
        deliveredStops: Number(stopStats[0]?.delivered ?? 0),
      }
    })(),
  ])

  const chartData: MonthlyRevenuePoint[] = monthlyRevenue.map(r => ({
    month: r.month.split(' ')[0], // "Jan 2025" → "Jan"
    revenue: Number(r.revenue),
  }))

  const tastingConversion = tastingConvStats[0]
  const convRate = tastingConversion && Number(tastingConversion.totalInteractions) > 0
    ? ((Number(tastingConversion.totalBottles) / Number(tastingConversion.totalInteractions)) * 100).toFixed(1)
    : null

  const deliveryCompletionRate = deliveryStats.totalStops > 0
    ? ((deliveryStats.deliveredStops / deliveryStats.totalStops) * 100).toFixed(0)
    : null

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
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
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
        <KpiCard
          title="Delivery Completion"
          value={deliveryCompletionRate != null ? `${deliveryCompletionRate}%` : '—'}
          change={`${deliveryStats.deliveredStops} of ${deliveryStats.totalStops} stops`}
          changeType={deliveryCompletionRate != null && Number(deliveryCompletionRate) >= 90 ? 'positive' : 'neutral'}
          icon={Truck}
          iconColor="text-sky-600"
        />
        <KpiCard
          title="Tasting Conversion"
          value={convRate != null ? `${convRate}%` : '—'}
          change={`${tastingConversion?.totalBottles ?? 0} bottles from tastings`}
          changeType={convRate != null && Number(convRate) >= 15 ? 'positive' : 'neutral'}
          icon={Wine}
          iconColor="text-violet-600"
        />
        <Card className="border-0 bg-white shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-500">SMS Inbox</p>
                <p className="mt-3 text-2xl font-bold tracking-tight text-slate-950">{smsInboxSummary.totalTexts}</p>
                <p className="mt-1.5 text-xs font-medium text-slate-500">Total texts logged</p>
              </div>
              <div className="rounded-xl bg-slate-100 p-2.5 shrink-0 text-emerald-600">
                <MessageSquare className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-4 flex items-end justify-between gap-3">
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

      {/* Monthly Revenue Chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Monthly Revenue (Last 12 Months)</CardTitle>
            <Link href="/admin/orders" className="text-xs text-primary hover:underline">View orders</Link>
          </CardHeader>
          <CardContent className="pt-0 pb-4">
            <RevenueChart data={chartData} />
          </CardContent>
        </Card>
      )}

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

        {/* Top Accounts */}
        {topAccounts.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Top Accounts by Revenue</CardTitle>
              <Link href="/admin/crm" className="text-xs text-primary hover:underline">View all</Link>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {topAccounts.map((acct, i) => (
                  <div key={acct.customerId} className="flex items-center gap-3 px-5 py-3">
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold
                      ${i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-slate-100 text-slate-600' : 'bg-slate-50 text-slate-500'}`}>
                      {i + 1}
                    </span>
                    <span className="flex-1 min-w-0 text-sm font-medium text-slate-900 truncate">{acct.companyName}</span>
                    <span className="text-sm font-semibold text-slate-700 shrink-0">{formatCurrency(acct.total ?? '0')}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
