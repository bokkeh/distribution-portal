import { requireRole } from '@/lib/auth/session'
import { db } from '@/db'
import { salesMembers, customerAccounts, orders } from '@/db/schema'
import { eq, and, gte, sql, desc } from 'drizzle-orm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { RevenueTrendChart } from './RevenueTrendChart'

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

export default async function SalesForecastPage() {
  const session = await requireRole('sales_rep', 'sales_manager', 'admin')

  const [member] = await db
    .select()
    .from(salesMembers)
    .where(eq(salesMembers.userId, session.user.id))
    .limit(1)

  const isAdmin = session.user.roles?.includes('admin')

  if (!member) {
    return (
      <div className="py-20 text-center text-slate-500">
        <AlertCircle className="w-10 h-10 mx-auto mb-3 text-amber-400" />
        <p className="font-medium">No sales member profile found.</p>
        {isAdmin && (
          <p className="text-sm mt-1">Use <strong>View as User</strong> on a rep&apos;s profile to see their forecast.</p>
        )}
      </div>
    )
  }

  // Build last 9 months of monthly revenue (attributed to this rep)
  const nineMonthsAgo = new Date()
  nineMonthsAgo.setMonth(nineMonthsAgo.getMonth() - 8)
  nineMonthsAgo.setDate(1)
  nineMonthsAgo.setHours(0, 0, 0, 0)

  const monthlyRows = await db
    .select({
      month: sql<string>`to_char(date_trunc('month', ${orders.createdAt}), 'YYYY-MM')`.as('month'),
      revenue: sql<number>`sum(${orders.total}::numeric)::float`.as('revenue'),
      orderCount: sql<number>`count(*)::int`.as('order_count'),
    })
    .from(orders)
    .where(and(
      eq(orders.attributedSalesMemberId, member.id),
      gte(orders.createdAt, nineMonthsAgo),
    ))
    .groupBy(sql`date_trunc('month', ${orders.createdAt})`)
    .orderBy(sql`date_trunc('month', ${orders.createdAt})`)

  // Fill in missing months (so chart has all months)
  const monthMap = new Map(monthlyRows.map(r => [r.month, { revenue: r.revenue, orderCount: r.orderCount }]))
  const months: Array<{ label: string; yearMonth: string; revenue: number; orderCount: number }> = []

  for (let i = 8; i >= 0; i--) {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    d.setDate(1)
    const yearMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
    const data = monthMap.get(yearMonth)
    months.push({ label, yearMonth, revenue: data?.revenue ?? 0, orderCount: data?.orderCount ?? 0 })
  }

  // Linear regression forecast for next 3 months
  const revenueValues = months.map(m => m.revenue)
  const n = revenueValues.length
  const sumX = (n * (n - 1)) / 2
  const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6
  const sumY = revenueValues.reduce((a, b) => a + b, 0)
  const sumXY = revenueValues.reduce((acc, y, i) => acc + i * y, 0)
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
  const intercept = (sumY - slope * sumX) / n

  const forecast: Array<{ label: string; revenue: number; projected: boolean }> = months.map(m => ({ ...m, projected: false }))
  for (let i = 1; i <= 3; i++) {
    const d = new Date()
    d.setMonth(d.getMonth() + i)
    d.setDate(1)
    const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
    const projectedRevenue = Math.max(0, intercept + slope * (n + i - 1))
    forecast.push({ label, revenue: projectedRevenue, projected: true })
  }

  // Top accounts by revenue (last 6 months)
  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

  const myAccountIds = await db
    .select({ id: customerAccounts.id, companyName: customerAccounts.companyName })
    .from(customerAccounts)
    .where(eq(customerAccounts.assignedSalesRepId, member.id))

  const accountIds = myAccountIds.map(a => a.id)
  const accountNameMap = new Map(myAccountIds.map(a => [a.id, a.companyName]))

  let topAccounts: Array<{ id: string; companyName: string; revenue: number; orderCount: number }> = []
  if (accountIds.length > 0) {
    const topRows = await db
      .select({
        customerId: orders.customerId,
        revenue: sql<number>`sum(${orders.total}::numeric)::float`.as('revenue'),
        orderCount: sql<number>`count(*)::int`.as('order_count'),
      })
      .from(orders)
      .where(and(
        sql`${orders.customerId} = ANY(ARRAY[${sql.raw(accountIds.map(id => `'${id}'`).join(','))}]::uuid[])`,
        gte(orders.createdAt, sixMonthsAgo),
      ))
      .groupBy(orders.customerId)
      .orderBy(desc(sql`sum(${orders.total}::numeric)`))
      .limit(8)

    topAccounts = topRows.map(r => ({
      id: r.customerId,
      companyName: accountNameMap.get(r.customerId) ?? r.customerId,
      revenue: r.revenue,
      orderCount: r.orderCount,
    }))
  }

  // MoM change (last 2 months)
  const lastMonth = months[months.length - 1]
  const prevMonth = months[months.length - 2]
  const momChange = prevMonth.revenue > 0
    ? ((lastMonth.revenue - prevMonth.revenue) / prevMonth.revenue) * 100
    : lastMonth.revenue > 0 ? 100 : 0

  const totalRevenue6mo = months.slice(3).reduce((s, m) => s + m.revenue, 0)
  const totalRevenue3mo = months.slice(6).reduce((s, m) => s + m.revenue, 0)
  const projectedNext3mo = forecast.filter(f => f.projected).reduce((s, f) => s + f.revenue, 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Sales Forecast</h1>
        <p className="text-slate-500 mt-1">Revenue trends and projections based on your order history</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-slate-500">Last Month</p>
            <p className="text-xl font-bold text-slate-900 mt-1">{fmt(lastMonth.revenue)}</p>
            <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${momChange > 0 ? 'text-green-600' : momChange < 0 ? 'text-red-500' : 'text-slate-400'}`}>
              {momChange > 0 ? <TrendingUp className="w-3 h-3" /> : momChange < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
              {momChange > 0 ? '+' : ''}{momChange.toFixed(0)}% vs prior month
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-slate-500">Last 3 Months</p>
            <p className="text-xl font-bold text-slate-900 mt-1">{fmt(totalRevenue3mo)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-slate-500">Last 6 Months</p>
            <p className="text-xl font-bold text-slate-900 mt-1">{fmt(totalRevenue6mo)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-slate-500">Projected Next 3 Mo</p>
            <p className="text-xl font-bold text-blue-700 mt-1">{fmt(projectedNext3mo)}</p>
            <p className="text-xs text-slate-400 mt-1">Linear trend estimate</p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue trend chart */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-slate-400" />
            Revenue Trend (9 months + 3 month forecast)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <RevenueTrendChart data={forecast} />
        </CardContent>
      </Card>

      {/* Top accounts */}
      {topAccounts.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-slate-700">Top Accounts by Revenue (last 6 months)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {topAccounts.map((account, idx) => {
              const pct = topAccounts[0].revenue > 0 ? (account.revenue / topAccounts[0].revenue) * 100 : 0
              return (
                <div key={account.id} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-800 truncate flex-1 mr-4">{account.companyName}</span>
                    <div className="text-right shrink-0">
                      <span className="font-semibold text-slate-900">{fmt(account.revenue)}</span>
                      <span className="text-xs text-slate-400 ml-2">{account.orderCount} orders</span>
                    </div>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-blue-500 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
