import { requireRole } from '@/lib/auth/session'
import { db } from '@/db'
import { salesMembers, customerAccounts, orders, commissions, users } from '@/db/schema'
import { eq, and, desc, sum, count, gte } from 'drizzle-orm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Building2, DollarSign, TrendingUp, Clock, CheckCircle2, AlertCircle } from 'lucide-react'
import Link from 'next/link'

export default async function SalesDashboardPage() {
  const session = await requireRole('sales_rep', 'sales_manager', 'admin')
  const userId = session.user.id

  // Find the sales member record for this user
  const [member] = await db
    .select()
    .from(salesMembers)
    .where(eq(salesMembers.userId, userId))
    .limit(1)

  if (!member) {
    return (
      <div className="text-center py-20 text-slate-500">
        <AlertCircle className="w-10 h-10 mx-auto mb-3 text-amber-400" />
        <p className="font-medium">No sales member profile found.</p>
        <p className="text-sm mt-1">Ask an admin to set up your sales member account.</p>
      </div>
    )
  }

  // Accounts assigned to this rep
  const accounts = await db
    .select()
    .from(customerAccounts)
    .where(eq(customerAccounts.assignedSalesRepId, member.id))

  const accountIds = accounts.map(a => a.id)

  // Recent orders attributed to this rep
  const recentOrders = accountIds.length
    ? await db
        .select()
        .from(orders)
        .where(eq(orders.attributedSalesMemberId, member.id))
        .orderBy(desc(orders.createdAt))
        .limit(10)
    : []

  // Commission summary
  const [commissionSum] = await db
    .select({ total: sum(commissions.amount) })
    .from(commissions)
    .where(and(eq(commissions.salesMemberId, member.id), eq(commissions.status, 'approved')))

  const [pendingCommissionSum] = await db
    .select({ total: sum(commissions.amount) })
    .from(commissions)
    .where(and(eq(commissions.salesMemberId, member.id), eq(commissions.status, 'pending')))

  // Accounts needing a visit
  const now = new Date()
  const overdueAccounts = accounts.filter(a => {
    if (!a.nextRequiredVisitDate) return false
    return new Date(a.nextRequiredVisitDate) < now
  })

  const totalRevenue = recentOrders.reduce((s, o) => s + parseFloat(o.total ?? '0'), 0)

  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Sales Dashboard</h1>
        <p className="text-slate-500 mt-1">Welcome back, {session.user.name}</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-50">
                <Building2 className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">My Accounts</p>
                <p className="text-2xl font-bold text-slate-900">{accounts.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-50">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Recent Revenue</p>
                <p className="text-2xl font-bold text-slate-900">{fmt(totalRevenue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-50">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Approved Commissions</p>
                <p className="text-2xl font-bold text-slate-900">{fmt(parseFloat(commissionSum?.total ?? '0'))}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-50">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Pending Commissions</p>
                <p className="text-2xl font-bold text-slate-900">{fmt(parseFloat(pendingCommissionSum?.total ?? '0'))}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Overdue visits */}
        {overdueAccounts.length > 0 && (
          <Card className="border-amber-200 bg-amber-50/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-500" />
                Overdue Visits ({overdueAccounts.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {overdueAccounts.slice(0, 5).map(a => (
                <div key={a.id} className="flex items-center justify-between text-sm">
                  <Link href={`/sales/accounts/${a.id}`} className="font-medium text-slate-800 hover:text-blue-600">
                    {a.companyName}
                  </Link>
                  <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50 text-xs">
                    Overdue
                  </Badge>
                </div>
              ))}
              {overdueAccounts.length > 5 && (
                <Link href="/sales/accounts?filter=overdue" className="text-xs text-blue-600 hover:underline">
                  +{overdueAccounts.length - 5} more
                </Link>
              )}
            </CardContent>
          </Card>
        )}

        {/* Recent orders */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-slate-400" />
              Recent Orders
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentOrders.length === 0 ? (
              <p className="text-sm text-slate-400 py-2">No orders attributed to you yet.</p>
            ) : (
              recentOrders.slice(0, 6).map(o => {
                const account = accounts.find(a => a.id === o.customerId)
                return (
                  <div key={o.id} className="flex items-center justify-between text-sm">
                    <div>
                      <p className="font-medium text-slate-800">{account?.companyName ?? 'Unknown Account'}</p>
                      <p className="text-xs text-slate-400">{new Date(o.createdAt).toLocaleDateString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-slate-900">{fmt(parseFloat(o.total ?? '0'))}</p>
                      <Badge
                        variant="outline"
                        className={`text-xs ${o.status === 'fulfilled' ? 'text-green-700 border-green-300' : 'text-blue-700 border-blue-300'}`}
                      >
                        {o.status}
                      </Badge>
                    </div>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
