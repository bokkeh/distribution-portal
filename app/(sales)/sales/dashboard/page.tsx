import { requireRole } from '@/lib/auth/session'
import { db } from '@/db'
import { salesMembers, customerAccounts, orders, commissions, users } from '@/db/schema'
import { eq, and, desc, sum, count } from 'drizzle-orm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Building2, DollarSign, TrendingUp, Clock, CheckCircle2, AlertCircle, Users } from 'lucide-react'
import Link from 'next/link'

export default async function SalesDashboardPage() {
  const session = await requireRole('sales_rep', 'sales_manager', 'admin')
  const userId = session.user.id
  const isManager = session.user.roles?.includes('sales_manager') || session.user.roles?.includes('admin')

  const [member] = await db
    .select()
    .from(salesMembers)
    .where(eq(salesMembers.userId, userId))
    .limit(1)

  const isAdmin = session.user.roles?.includes('admin')

  if (!member && !isAdmin) {
    return (
      <div className="text-center py-20 text-slate-500">
        <AlertCircle className="w-10 h-10 mx-auto mb-3 text-amber-400" />
        <p className="font-medium">No sales member profile found.</p>
        <p className="text-sm mt-1">Ask an admin to set up your sales member account.</p>
      </div>
    )
  }

  if (!member && isAdmin) {
    return (
      <div className="text-center py-20 text-slate-500">
        <AlertCircle className="w-10 h-10 mx-auto mb-3 text-blue-400" />
        <p className="font-medium text-slate-700">No sales member profile linked to your account.</p>
        <p className="text-sm mt-1">
          To view a rep&apos;s dashboard, use <strong>View as User</strong> on their profile page, or create a sales member record for your user in <a href="/admin/sales" className="text-blue-600 underline">Admin → Sales</a>.
        </p>
      </div>
    )
  }

  // Accounts assigned to this rep
  const accounts = await db
    .select()
    .from(customerAccounts)
    .where(eq(customerAccounts.assignedSalesRepId, member.id))

  // Recent orders attributed to this rep
  const recentOrders = await db
    .select()
    .from(orders)
    .where(eq(orders.attributedSalesMemberId, member.id))
    .orderBy(desc(orders.createdAt))
    .limit(10)

  // Commission summary
  const [commissionSum] = await db
    .select({ total: sum(commissions.amount) })
    .from(commissions)
    .where(and(eq(commissions.salesMemberId, member.id), eq(commissions.status, 'approved')))

  const [pendingCommissionSum] = await db
    .select({ total: sum(commissions.amount) })
    .from(commissions)
    .where(and(eq(commissions.salesMemberId, member.id), eq(commissions.status, 'pending')))

  const now = new Date()
  const overdueAccounts = accounts.filter(a => {
    if (!a.nextRequiredVisitDate) return false
    return new Date(a.nextRequiredVisitDate) < now
  })

  const totalRevenue = recentOrders.reduce((s, o) => s + parseFloat(o.total ?? '0'), 0)
  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

  // Manager: fetch team overview
  let teamStats: Array<{
    member: typeof salesMembers.$inferSelect
    user: { id: string; name: string; email: string }
    accountCount: number
    pendingCommissions: number
    recentRevenue: number
  }> = []

  if (isManager) {
    const teamMembers = await db
      .select({ member: salesMembers, user: { id: users.id, name: users.name, email: users.email } })
      .from(salesMembers)
      .innerJoin(users, eq(salesMembers.userId, users.id))
      .where(eq(salesMembers.managerId, member.id))

    teamStats = await Promise.all(
      teamMembers.map(async ({ member: tm, user }) => {
        const [acctCount] = await db
          .select({ count: count() })
          .from(customerAccounts)
          .where(eq(customerAccounts.assignedSalesRepId, tm.id))

        const [pending] = await db
          .select({ total: sum(commissions.amount) })
          .from(commissions)
          .where(and(eq(commissions.salesMemberId, tm.id), eq(commissions.status, 'pending')))

        const repOrders = await db
          .select({ total: orders.total })
          .from(orders)
          .where(eq(orders.attributedSalesMemberId, tm.id))
          .orderBy(desc(orders.createdAt))
          .limit(20)

        const recentRevenue = repOrders.reduce((s, o) => s + parseFloat(o.total ?? '0'), 0)

        return {
          member: tm,
          user,
          accountCount: acctCount?.count ?? 0,
          pendingCommissions: parseFloat(pending?.total ?? '0'),
          recentRevenue,
        }
      })
    )
  }

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
                <Link href="/sales/accounts" className="text-xs text-blue-600 hover:underline">
                  +{overdueAccounts.length - 5} more →
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

      {/* Manager: Team Overview */}
      {isManager && teamStats.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-slate-400" />
            My Team ({teamStats.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {teamStats.map(({ member: tm, user, accountCount, pendingCommissions, recentRevenue }) => (
              <Card key={tm.id}>
                <CardContent className="pt-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-blue-700">
                        {user.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 truncate">{user.name}</p>
                      <Badge
                        variant="outline"
                        className={`text-xs mt-0.5 ${
                          tm.status === 'active' ? 'text-green-700 border-green-300' :
                          tm.status === 'inactive' ? 'text-amber-700 border-amber-300' :
                          'text-red-700 border-red-300'
                        }`}
                      >
                        {tm.status}
                      </Badge>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <p className="text-xs text-slate-400">Accounts</p>
                      <p className="font-bold text-slate-900 text-lg">{accountCount}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Revenue</p>
                      <p className="font-bold text-slate-900 text-lg">{fmt(recentRevenue)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Pending</p>
                      <p className="font-bold text-amber-600 text-lg">{fmt(pendingCommissions)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {isManager && teamStats.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-slate-400">
            <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No reps assigned to you yet. Admins can set manager assignments on each sales member's profile.</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
