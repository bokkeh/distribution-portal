import Link from 'next/link'
import { and, desc, eq, inArray, sum } from 'drizzle-orm'
import { AlertCircle, ArrowRight, Building2, CalendarClock, DollarSign, Map as MapIcon, Target, Users, Wine } from 'lucide-react'
import { requireRole } from '@/lib/auth/session'
import { db } from '@/db'
import { commissions, customerAccounts, orders, salesMembers, salesRoutes, tastings, users } from '@/db/schema'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { IndustryNewsWidget } from '@/components/news/IndustryNewsWidget'
import { getReorderFollowUps, LOW_INVENTORY_CASE_THRESHOLD, SINGLE_CASE_REORDER_DELAY_DAYS } from '@/lib/sales/reorder-follow-ups'
import { getTasksForView } from '@/lib/tasks/read'
import { TaskDashboardModule } from '@/components/tasks/TaskDashboardModule'

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

function daysBetween(from: Date, to: Date) {
  return Math.ceil((to.getTime() - from.getTime()) / 86400000)
}

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
      <div className="py-20 text-center text-slate-500">
        <AlertCircle className="mx-auto mb-3 h-10 w-10 text-amber-400" />
        <p className="font-medium">No sales member profile found.</p>
        <p className="mt-1 text-sm">Ask an admin to set up your sales member account.</p>
      </div>
    )
  }

  if (!member && isAdmin) {
    return (
      <div className="py-20 text-center text-slate-500">
        <AlertCircle className="mx-auto mb-3 h-10 w-10 text-blue-400" />
        <p className="font-medium text-slate-700">No sales member profile linked to your account.</p>
        <p className="mt-1 text-sm">
          To view a rep&apos;s dashboard, use <strong>View as User</strong> on their profile page, or create a sales member record for your user in <a href="/admin/sales" className="text-blue-600 underline">Admin → Sales</a>.
        </p>
      </div>
    )
  }

  const accounts = await db
    .select()
    .from(customerAccounts)
    .where(eq(customerAccounts.assignedSalesRepId, member.id))

  const routes = await db
    .select({
      id: salesRoutes.id,
      name: salesRoutes.name,
      status: salesRoutes.status,
      frequency: salesRoutes.frequency,
      createdAt: salesRoutes.createdAt,
    })
    .from(salesRoutes)
    .where(eq(salesRoutes.assignedSalesMemberId, member.id))
    .orderBy(desc(salesRoutes.createdAt))

  const recentOrders = await db
    .select()
    .from(orders)
    .where(eq(orders.attributedSalesMemberId, member.id))
    .orderBy(desc(orders.createdAt))
    .limit(12)

  const [commissionSum] = await db
    .select({ total: sum(commissions.amount) })
    .from(commissions)
    .where(and(eq(commissions.salesMemberId, member.id), eq(commissions.status, 'approved')))

  const [pendingCommissionSum] = await db
    .select({ total: sum(commissions.amount) })
    .from(commissions)
    .where(and(eq(commissions.salesMemberId, member.id), eq(commissions.status, 'pending')))

  const accountIds = accounts.map(account => account.id)
  const upcomingTastings = accountIds.length > 0
    ? await db
        .select({
          id: tastings.id,
          eventName: tastings.eventName,
          scheduledAt: tastings.scheduledAt,
          customerId: tastings.customerId,
          status: tastings.status,
        })
        .from(tastings)
        .where(inArray(tastings.customerId, accountIds))
        .orderBy(desc(tastings.scheduledAt))
        .limit(10)
    : []

  const now = new Date()
  const overdueAccounts = accounts.filter(account => account.nextRequiredVisitDate && new Date(account.nextRequiredVisitDate) < now)
  const dueSoonAccounts = accounts.filter(account => {
    if (!account.nextRequiredVisitDate) return false
    const nextDate = new Date(account.nextRequiredVisitDate)
    return nextDate >= now && daysBetween(now, nextDate) <= 7
  })
  const highPriorityAccounts = accounts.filter(account => account.accountPriority === 'high')
  const mappedAccounts = accounts.filter(account => account.lat != null && account.lng != null)
  const openBalanceAccounts = accounts.filter(account => Number(account.balance ?? '0') > 0)
  const activeRoutes = routes.filter(route => route.status === 'active')
  const nextTastings = upcomingTastings.filter(tasting => new Date(tasting.scheduledAt) >= now).slice(0, 4)
  const totalRevenue = recentOrders.reduce((sumValue, order) => sumValue + Number(order.total ?? '0'), 0)

  const reorderTargets = (await getReorderFollowUps(accounts)).slice(0, 5)

  let teamStats: Array<{
    member: typeof salesMembers.$inferSelect
    user: { id: string; name: string; email: string }
    accountCount: number
    pendingCommissions: number
    recentRevenue: number
    overdueVisits: number
  }> = []

  if (isManager) {
    const teamMembers = await db
      .select({ member: salesMembers, user: { id: users.id, name: users.name, email: users.email } })
      .from(salesMembers)
      .innerJoin(users, eq(salesMembers.userId, users.id))
      .where(eq(salesMembers.managerId, member.id))

    teamStats = await Promise.all(
      teamMembers.map(async ({ member: teamMember, user }) => {
        const repAccounts = await db.select().from(customerAccounts).where(eq(customerAccounts.assignedSalesRepId, teamMember.id))

        const [pending] = await db
          .select({ total: sum(commissions.amount) })
          .from(commissions)
          .where(and(eq(commissions.salesMemberId, teamMember.id), eq(commissions.status, 'pending')))

        const repOrders = await db
          .select({ total: orders.total })
          .from(orders)
          .where(eq(orders.attributedSalesMemberId, teamMember.id))
          .orderBy(desc(orders.createdAt))
          .limit(20)

        return {
          member: teamMember,
          user,
          accountCount: repAccounts.length,
          pendingCommissions: Number(pending?.total ?? '0'),
          recentRevenue: repOrders.reduce((sumValue, order) => sumValue + Number(order.total ?? '0'), 0),
          overdueVisits: repAccounts.filter(account => account.nextRequiredVisitDate && new Date(account.nextRequiredVisitDate) < now).length,
        }
      }),
    )
  }

  const actionQueue = [
    {
      label: 'Overdue account visits',
      count: overdueAccounts.length,
      href: '/sales/accounts',
      description: 'Accounts already past their next required visit date.',
      tone: overdueAccounts.length > 0 ? 'warning' : 'success',
    },
    {
      label: 'Due this week',
      count: dueSoonAccounts.length,
      href: '/sales/accounts',
      description: 'Accounts that need attention in the next seven days.',
      tone: dueSoonAccounts.length > 0 ? 'info' : 'success',
    },
    {
      label: 'Reorder follow-ups',
      count: reorderTargets.length,
      href: '/sales/accounts',
      description: `Accounts at ${LOW_INVENTORY_CASE_THRESHOLD} case left, plus ${SINGLE_CASE_REORDER_DELAY_DAYS}-day 1-case follow-ups.`,
      tone: reorderTargets.length > 0 ? 'warning' : 'success',
    },
    {
      label: 'Upcoming tastings',
      count: nextTastings.length,
      href: '/sales/tastings',
      description: 'Tastings associated with your book of business.',
      tone: nextTastings.length > 0 ? 'info' : 'secondary',
    },
  ]
  const dashboardTasks = await getTasksForView({ userId, roles: session.user.roles ?? [session.user.role as string], limit: 12 })

  return (
    <div className="space-y-6">
      <TaskDashboardModule tasks={dashboardTasks} mode="sales" nowIso={new Date().toISOString()} />
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-blue-50">
        <div className="grid gap-6 px-6 py-6 lg:grid-cols-[1.15fr_0.85fr] lg:px-8">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="info">Sales Command Center</Badge>
              {isManager ? <Badge variant="outline" className="border-slate-300 text-slate-700">Manager view</Badge> : null}
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">Sales Dashboard</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-600">
                Prioritize visits, monitor revenue movement, and keep your routes, tastings, and commissions in one operating view.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-slate-500">Accounts</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">{accounts.length}</p>
                <p className="mt-1 text-xs text-slate-500">{highPriorityAccounts.length} high priority</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-slate-500">Recent revenue</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">{formatCurrency(totalRevenue)}</p>
                <p className="mt-1 text-xs text-slate-500">Across your latest {recentOrders.length} orders</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-slate-500">Pending commissions</p>
                <p className="mt-2 text-3xl font-bold text-amber-600">{formatCurrency(Number(pendingCommissionSum?.total ?? '0'))}</p>
                <p className="mt-1 text-xs text-slate-500">Approved: {formatCurrency(Number(commissionSum?.total ?? '0'))}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-slate-500">Active routes</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">{activeRoutes.length}</p>
                <p className="mt-1 text-xs text-slate-500">{mappedAccounts.length}/{accounts.length} accounts mapped</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/sales/accounts">
                <Button>Open My Accounts</Button>
              </Link>
              <Link href="/sales/routes">
                <Button variant="outline">Manage Routes</Button>
              </Link>
              <Link href="/sales/tastings">
                <Button variant="outline">Coordinate Tastings</Button>
              </Link>
            </div>
          </div>

          <Card className="border-slate-200 bg-white/90 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Today&apos;s Action Queue</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {actionQueue.map(item => (
                <Link key={item.label} href={item.href} className="block rounded-2xl border border-slate-200 px-4 py-3 transition-colors hover:bg-slate-50">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-900">{item.label}</p>
                      <p className="mt-1 text-xs text-slate-500">{item.description}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={item.tone === 'warning' ? 'warning' : item.tone === 'success' ? 'success' : item.tone === 'info' ? 'info' : 'secondary'}
                        className="min-w-10 justify-center"
                      >
                        {item.count}
                      </Badge>
                      <ArrowRight className="h-4 w-4 text-slate-400" />
                    </div>
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Target className="h-4 w-4 text-slate-400" />
                Portfolio Health
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Visit pressure</p>
                <p className="mt-2 text-2xl font-bold text-amber-600">{overdueAccounts.length}</p>
                <p className="mt-1 text-xs text-slate-500">Accounts already overdue</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Due this week</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{dueSoonAccounts.length}</p>
                <p className="mt-1 text-xs text-slate-500">Plan route coverage now</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Open balances</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{openBalanceAccounts.length}</p>
                <p className="mt-1 text-xs text-slate-500">Accounts carrying receivables</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Mapped coverage</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{accounts.length > 0 ? `${Math.round((mappedAccounts.length / accounts.length) * 100)}%` : '0%'}</p>
                <p className="mt-1 text-xs text-slate-500">Accounts ready for route planning</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="h-4 w-4 text-slate-400" />
                Accounts Requiring Attention
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {overdueAccounts.length === 0 && dueSoonAccounts.length === 0 && reorderTargets.length === 0 ? (
                <p className="text-sm text-slate-500">Your portfolio is current. Use routes and tastings to create the next round of activity.</p>
              ) : (
                <>
                  {overdueAccounts.slice(0, 4).map(account => (
                    <Link key={account.id} href={`/sales/accounts/${account.id}`} className="flex items-start justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50/60 px-4 py-3 transition-colors hover:bg-amber-50">
                      <div>
                        <p className="font-medium text-slate-900">{account.companyName}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          Visit overdue since {new Date(account.nextRequiredVisitDate!).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge variant="warning">Overdue</Badge>
                    </Link>
                  ))}
                  {reorderTargets.slice(0, 3).map((followUp) => (
                    <Link key={followUp.accountId} href={`/sales/accounts/${followUp.accountId}`} className="flex items-start justify-between gap-4 rounded-2xl border border-slate-200 px-4 py-3 transition-colors hover:bg-slate-50">
                      <div>
                        <p className="font-medium text-slate-900">{followUp.companyName}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {followUp.reason}
                        </p>
                      </div>
                      <Badge variant="outline">Reorder</Badge>
                    </Link>
                  ))}
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <DollarSign className="h-4 w-4 text-slate-400" />
                Recent Orders
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentOrders.length === 0 ? (
                <p className="text-sm text-slate-500">No orders attributed to you yet.</p>
              ) : (
                recentOrders.slice(0, 8).map(order => {
                  const account = accounts.find(candidate => candidate.id === order.customerId)
                  return (
                    <div key={order.id} className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 px-4 py-3">
                      <div>
                        <p className="font-medium text-slate-900">{account?.companyName ?? 'Unknown Account'}</p>
                        <p className="mt-1 text-xs text-slate-500">{new Date(order.createdAt).toLocaleDateString()}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-slate-900">{formatCurrency(Number(order.total ?? '0'))}</p>
                        <Badge variant={order.status === 'fulfilled' ? 'success' : 'outline'} className="mt-1 capitalize">
                          {order.status}
                        </Badge>
                      </div>
                    </div>
                  )
                })
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <MapIcon className="h-4 w-4 text-slate-400" />
                Route Coverage
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {activeRoutes.length === 0 ? (
                <p className="text-sm text-slate-500">No active routes yet. Build a route to structure visit days and stop sequencing.</p>
              ) : (
                activeRoutes.slice(0, 5).map(route => (
                  <Link key={route.id} href={`/sales/routes/${route.id}`} className="block rounded-2xl border border-slate-200 px-4 py-3 transition-colors hover:bg-slate-50">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-slate-900">{route.name}</p>
                        <p className="mt-1 text-xs text-slate-500">Created {new Date(route.createdAt).toLocaleDateString()}</p>
                      </div>
                      <Badge variant="outline" className="capitalize">{route.frequency ?? 'custom'}</Badge>
                    </div>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Wine className="h-4 w-4 text-slate-400" />
                Upcoming Tastings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {nextTastings.length === 0 ? (
                <p className="text-sm text-slate-500">No tastings are on the calendar for your accounts right now.</p>
              ) : (
                nextTastings.map(tasting => {
                  const account = accounts.find(candidate => candidate.id === tasting.customerId)
                  return (
                    <Link key={tasting.id} href="/sales/tastings" className="block rounded-2xl border border-slate-200 px-4 py-3 transition-colors hover:bg-slate-50">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-slate-900">{account?.companyName ?? tasting.eventName}</p>
                          <p className="mt-1 text-xs text-slate-500">{new Date(tasting.scheduledAt).toLocaleString()}</p>
                        </div>
                        <Badge variant={tasting.status === 'confirmed' ? 'success' : 'info'} className="capitalize">
                          {tasting.status}
                        </Badge>
                      </div>
                    </Link>
                  )
                })
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarClock className="h-4 w-4 text-slate-400" />
                Quick Links
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <Link href="/sales/accounts" className="rounded-2xl border border-slate-200 px-4 py-3 transition-colors hover:bg-slate-50">
                <p className="font-medium text-slate-900">Account Book</p>
                <p className="mt-1 text-xs text-slate-500">Call notes, balances, and visit scheduling for your portfolio.</p>
              </Link>
              <Link href="/sales/forecast" className="rounded-2xl border border-slate-200 px-4 py-3 transition-colors hover:bg-slate-50">
                <p className="font-medium text-slate-900">Forecast</p>
                <p className="mt-1 text-xs text-slate-500">Revenue trendlines and pacing for the pipeline.</p>
              </Link>
              <Link href="/sales/commissions" className="rounded-2xl border border-slate-200 px-4 py-3 transition-colors hover:bg-slate-50">
                <p className="font-medium text-slate-900">Commission Tracking</p>
                <p className="mt-1 text-xs text-slate-500">See what is approved, pending, and ready to reconcile.</p>
              </Link>
            </CardContent>
          </Card>

          <IndustryNewsWidget audience="sales" />
        </div>
      </div>

      {isManager && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-slate-400" />
              Team Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            {teamStats.length === 0 ? (
              <p className="text-sm text-slate-500">No reps assigned to you yet. Admins can set manager assignments on each sales member profile.</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {teamStats.map(({ member: teamMember, user, accountCount, pendingCommissions, recentRevenue, overdueVisits }) => (
                  <div key={teamMember.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">{user.name}</p>
                        <p className="mt-1 text-xs text-slate-500">{user.email}</p>
                      </div>
                      <Badge
                        variant={teamMember.status === 'active' ? 'success' : teamMember.status === 'inactive' ? 'warning' : 'destructive'}
                        className="capitalize"
                      >
                        {teamMember.status}
                      </Badge>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-xl bg-slate-50 p-3">
                        <p className="text-xs uppercase tracking-wide text-slate-500">Accounts</p>
                        <p className="mt-1 text-xl font-bold text-slate-900">{accountCount}</p>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-3">
                        <p className="text-xs uppercase tracking-wide text-slate-500">Revenue</p>
                        <p className="mt-1 text-xl font-bold text-slate-900">{formatCurrency(recentRevenue)}</p>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-3">
                        <p className="text-xs uppercase tracking-wide text-slate-500">Pending</p>
                        <p className="mt-1 text-xl font-bold text-amber-600">{formatCurrency(pendingCommissions)}</p>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-3">
                        <p className="text-xs uppercase tracking-wide text-slate-500">Overdue visits</p>
                        <p className="mt-1 text-xl font-bold text-slate-900">{overdueVisits}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
