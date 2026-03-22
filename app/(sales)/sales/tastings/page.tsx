import { requireRole } from '@/lib/auth/session'
import { db } from '@/db'
import { salesMembers, customerAccounts, tastings, invoices, orders } from '@/db/schema'
import { eq, and, desc, sql, gte, lt } from 'drizzle-orm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, Wine, TrendingUp, DollarSign, BarChart3 } from 'lucide-react'
import Link from 'next/link'
import { RequestTastingModal } from './RequestTastingModal'

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

function fmtDate(d: Date | string) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(d))
}

export default async function SalesTastingsPage() {
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
          <p className="text-sm mt-1">Use <strong>View as User</strong> on a rep&apos;s profile to see their tasting ROI.</p>
        )}
      </div>
    )
  }

  // Accounts assigned to this rep
  const myAccounts = await db
    .select({ id: customerAccounts.id, companyName: customerAccounts.companyName })
    .from(customerAccounts)
    .where(eq(customerAccounts.assignedSalesRepId, member.id))

  const accountIds = myAccounts.map(a => a.id)
  const accountNameById = new Map(myAccounts.map(a => [a.id, a.companyName]))

  if (accountIds.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tasting ROI</h1>
          <p className="text-slate-500 mt-1">Revenue impact from in-store tastings</p>
        </div>
        <Card>
          <CardContent className="py-12 text-center text-slate-400">
            <Wine className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>No accounts assigned yet.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // All completed tastings for my accounts
  const myTastings = await db
    .select({
      id: tastings.id,
      customerId: tastings.customerId,
      eventName: tastings.eventName,
      scheduledAt: tastings.scheduledAt,
      status: tastings.status,
    })
    .from(tastings)
    .where(
      sql`${tastings.customerId} = ANY(ARRAY[${sql.raw(accountIds.map(id => `'${id}'`).join(','))}]::uuid[])`
    )
    .orderBy(desc(tastings.scheduledAt))

  // Revenue per account in 60 days AFTER most recent tasting vs 60 days BEFORE
  const accountsWithTastings = [...new Set(myTastings.map(t => t.customerId))]

  type ROIRow = {
    accountId: string
    companyName: string
    tastingCount: number
    lastTastingDate: Date
    revenueBefore: number
    revenueAfter: number
    lift: number
    liftPct: number
  }

  const roiRows: ROIRow[] = []

  for (const accountId of accountsWithTastings) {
    const accountTastings = myTastings.filter(t => t.customerId === accountId)
    const lastTasting = accountTastings[0]
    if (!lastTasting) continue

    const tastingDate = new Date(lastTasting.scheduledAt)
    const before60Start = new Date(tastingDate)
    before60Start.setDate(before60Start.getDate() - 60)
    const after60End = new Date(tastingDate)
    after60End.setDate(after60End.getDate() + 60)

    const [beforeRow] = await db
      .select({ rev: sql<number>`coalesce(sum(${orders.total}::numeric), 0)::float`.as('rev') })
      .from(orders)
      .where(and(
        eq(orders.customerId, accountId),
        gte(orders.createdAt, before60Start),
        lt(orders.createdAt, tastingDate),
      ))

    const [afterRow] = await db
      .select({ rev: sql<number>`coalesce(sum(${orders.total}::numeric), 0)::float`.as('rev') })
      .from(orders)
      .where(and(
        eq(orders.customerId, accountId),
        gte(orders.createdAt, tastingDate),
        lt(orders.createdAt, after60End),
      ))

    const revBefore = beforeRow?.rev ?? 0
    const revAfter = afterRow?.rev ?? 0
    const lift = revAfter - revBefore
    const liftPct = revBefore > 0 ? (lift / revBefore) * 100 : revAfter > 0 ? 100 : 0

    roiRows.push({
      accountId,
      companyName: accountNameById.get(accountId) ?? accountId,
      tastingCount: accountTastings.length,
      lastTastingDate: tastingDate,
      revenueBefore: revBefore,
      revenueAfter: revAfter,
      lift,
      liftPct,
    })
  }

  roiRows.sort((a, b) => b.lift - a.lift)

  const totalTastings = myTastings.length
  const completedTastings = myTastings.filter(t => t.status === 'completed').length
  const totalLift = roiRows.reduce((s, r) => s + r.lift, 0)
  const avgLiftPct = roiRows.length > 0
    ? roiRows.reduce((s, r) => s + r.liftPct, 0) / roiRows.length
    : 0
  const positiveImpact = roiRows.filter(r => r.lift > 0).length

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tasting ROI</h1>
          <p className="text-slate-500 mt-1">Revenue impact from in-store tastings (60-day window)</p>
        </div>
        <RequestTastingModal accounts={myAccounts.map(a => ({ id: a.id, companyName: a.companyName }))} />
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-50">
                <Wine className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Total Tastings</p>
                <p className="text-xl font-bold text-slate-900">{totalTastings}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-50">
                <DollarSign className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Total Revenue Lift</p>
                <p className={`text-xl font-bold ${totalLift >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmt(totalLift)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-50">
                <TrendingUp className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Avg Lift %</p>
                <p className={`text-xl font-bold ${avgLiftPct >= 0 ? 'text-blue-700' : 'text-red-600'}`}>
                  {avgLiftPct > 0 ? '+' : ''}{avgLiftPct.toFixed(0)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-50">
                <BarChart3 className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Positive Impact</p>
                <p className="text-xl font-bold text-slate-900">{positiveImpact}/{roiRows.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Per-account ROI table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <Wine className="w-4 h-4 text-slate-400" />
            Revenue Before vs After Tasting (60-day window)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {roiRows.length === 0 ? (
            <div className="py-10 text-center text-slate-400 text-sm">
              No tastings recorded for your accounts.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {roiRows.map(row => (
                <div key={row.accountId} className="px-6 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <Link href={`/sales/accounts/${row.accountId}`} className="font-medium text-slate-900 hover:text-blue-600 text-sm">
                        {row.companyName}
                      </Link>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-400 flex-wrap">
                        <span>{row.tastingCount} tasting{row.tastingCount !== 1 ? 's' : ''}</span>
                        <span>Last: {fmtDate(row.lastTastingDate)}</span>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={`text-base font-bold ${row.lift > 0 ? 'text-green-700' : row.lift < 0 ? 'text-red-600' : 'text-slate-500'}`}>
                        {row.lift > 0 ? '+' : ''}{fmt(row.lift)}
                      </p>
                      <p className={`text-xs ${row.liftPct > 0 ? 'text-green-600' : row.liftPct < 0 ? 'text-red-500' : 'text-slate-400'}`}>
                        {row.liftPct > 0 ? '+' : ''}{row.liftPct.toFixed(0)}% lift
                      </p>
                    </div>
                  </div>
                  {/* Mini before/after bar */}
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <div className="rounded-md bg-slate-50 border border-slate-100 px-2.5 py-1.5">
                      <p className="text-[10px] text-slate-400 uppercase tracking-wide">Before</p>
                      <p className="text-sm font-semibold text-slate-700">{fmt(row.revenueBefore)}</p>
                    </div>
                    <div className={`rounded-md px-2.5 py-1.5 border ${row.revenueAfter >= row.revenueBefore ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
                      <p className="text-[10px] text-slate-400 uppercase tracking-wide">After</p>
                      <p className={`text-sm font-semibold ${row.revenueAfter >= row.revenueBefore ? 'text-green-700' : 'text-red-600'}`}>{fmt(row.revenueAfter)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent tastings list */}
      {myTastings.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-slate-700">All Tastings ({myTastings.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100">
              {myTastings.slice(0, 20).map(t => (
                <div key={t.id} className="flex items-center justify-between gap-4 px-6 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-800 truncate">{t.eventName}</p>
                    <p className="text-xs text-slate-400">{accountNameById.get(t.customerId) ?? ''} · {fmtDate(t.scheduledAt)}</p>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-xs capitalize shrink-0 ${
                      t.status === 'completed' ? 'text-green-700 border-green-300 bg-green-50' :
                      t.status === 'cancelled' || t.status === 'declined' ? 'text-red-600 border-red-300 bg-red-50' :
                      t.status === 'confirmed' ? 'text-blue-700 border-blue-300 bg-blue-50' :
                      'text-amber-700 border-amber-300 bg-amber-50'
                    }`}
                  >
                    {t.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
