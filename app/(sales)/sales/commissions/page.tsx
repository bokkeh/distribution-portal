import { requireRole } from '@/lib/auth/session'
import { db } from '@/db'
import { salesMembers, commissions, orders, customerAccounts } from '@/db/schema'
import { eq, and, desc, sum } from 'drizzle-orm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { DollarSign, Clock, CheckCircle2, Banknote, TrendingUp, AlertCircle } from 'lucide-react'
import Link from 'next/link'

const STATUS_STYLE: Record<string, string> = {
  pending:  'bg-amber-50  text-amber-700  border-amber-200',
  approved: 'bg-blue-50   text-blue-700   border-blue-200',
  paid:     'bg-green-50  text-green-700  border-green-200',
  voided:   'bg-slate-100 text-slate-500  border-slate-200',
}

const TYPE_LABEL: Record<string, string> = {
  order_based:   'Order',
  manual_bonus:  'Bonus',
  adjustment:    'Adjustment',
  spiff:         'Spiff',
  penalty:       'Penalty',
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

function fmtDate(d: Date | string) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(d))
}

export default async function SalesCommissionsPage() {
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
          <p className="text-sm mt-1">Use <strong>View as User</strong> on a rep&apos;s profile to see their commissions, or create a sales member record for your user.</p>
        )}
      </div>
    )
  }

  // All commissions for this member with linked order + account info
  const rows = await db
    .select({
      commission: commissions,
      orderTotal: orders.total,
      companyName: customerAccounts.companyName,
    })
    .from(commissions)
    .leftJoin(orders, eq(commissions.orderId, orders.id))
    .leftJoin(customerAccounts, eq(commissions.accountId, customerAccounts.id))
    .where(eq(commissions.salesMemberId, member.id))
    .orderBy(desc(commissions.createdAt))

  // Summaries by status
  const byStatus = (status: string) =>
    rows.filter(r => r.commission.status === status)

  const totalPaid     = byStatus('paid').reduce((s, r) => s + parseFloat(r.commission.amount), 0)
  const totalApproved = byStatus('approved').reduce((s, r) => s + parseFloat(r.commission.amount), 0)
  const totalPending  = byStatus('pending').reduce((s, r) => s + parseFloat(r.commission.amount), 0)
  const totalEarned   = totalPaid + totalApproved

  const activeRows = rows.filter(r => r.commission.status !== 'voided')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">My Commissions</h1>
        <p className="text-slate-500 mt-1">Your earnings pipeline from pending to paid</p>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-50">
                <Banknote className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Total Paid</p>
                <p className="text-xl font-bold text-slate-900">{fmt(totalPaid)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-50">
                <CheckCircle2 className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Approved</p>
                <p className="text-xl font-bold text-slate-900">{fmt(totalApproved)}</p>
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
                <p className="text-xs text-slate-500">Pending</p>
                <p className="text-xl font-bold text-slate-900">{fmt(totalPending)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-50">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Total Earned</p>
                <p className="text-xl font-bold text-emerald-700">{fmt(totalEarned)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pipeline visual */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-slate-700">Earnings Pipeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-0 text-sm">
            {[
              { label: 'Pending', amount: totalPending, color: 'bg-amber-100 text-amber-800', border: 'rounded-l-xl' },
              { label: 'Approved', amount: totalApproved, color: 'bg-blue-100 text-blue-800', border: '' },
              { label: 'Paid', amount: totalPaid, color: 'bg-green-100 text-green-800', border: 'rounded-r-xl' },
            ].map(({ label, amount, color, border }) => {
              const total = totalPending + totalApproved + totalPaid || 1
              const pct = Math.round((amount / total) * 100)
              return (
                <div
                  key={label}
                  className={`flex-1 px-3 py-2.5 text-center ${color} ${border}`}
                  style={{ minWidth: 0 }}
                >
                  <p className="font-semibold truncate">{fmt(amount)}</p>
                  <p className="text-xs opacity-70">{label} · {pct}%</p>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Full history */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-slate-400" />
            All Commissions ({activeRows.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {activeRows.length === 0 ? (
            <div className="py-10 text-center text-slate-400 text-sm">
              No commissions recorded yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {activeRows.map(({ commission: c, orderTotal, companyName }) => (
                <div key={c.id} className="flex items-center justify-between gap-4 px-6 py-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-slate-900 text-sm">
                        {c.description ?? (companyName ? companyName : 'Commission')}
                      </span>
                      <Badge variant="outline" className={`text-xs border ${STATUS_STYLE[c.status]}`}>
                        {c.status}
                      </Badge>
                      <Badge variant="outline" className="text-xs text-slate-500 border-slate-200">
                        {TYPE_LABEL[c.type] ?? c.type}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-400 flex-wrap">
                      <span>{fmtDate(c.createdAt)}</span>
                      {orderTotal && (
                        <span>Order total: {fmt(parseFloat(orderTotal))}</span>
                      )}
                      {c.paidAt && <span>Paid {fmtDate(c.paidAt)}</span>}
                      {c.notes && <span className="italic">{c.notes}</span>}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={`text-base font-bold ${c.type === 'penalty' ? 'text-red-600' : 'text-slate-900'}`}>
                      {c.type === 'penalty' ? '-' : '+'}{fmt(parseFloat(c.amount))}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
