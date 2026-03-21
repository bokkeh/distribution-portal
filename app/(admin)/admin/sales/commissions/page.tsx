import { requireAdmin } from '@/lib/auth/session'
import { getAllPendingCommissions } from '@/actions/sales-members'
import { db } from '@/db'
import { commissions, salesMembers, orders, users } from '@/db/schema'
import { desc, eq } from 'drizzle-orm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { DollarSign } from 'lucide-react'
import { CommissionApproveButton } from './CommissionApproveButton'
import { auth } from '@/lib/auth/config'

export default async function CommissionsPage() {
  const session = await requireAdmin()
  const pending = await getAllPendingCommissions()

  // Also fetch recently approved/paid for visibility
  const recentRows = await db
    .select({
      commission: commissions,
      member: salesMembers,
      user: { id: users.id, name: users.name },
      order: { id: orders.id, total: orders.total, createdAt: orders.createdAt },
    })
    .from(commissions)
    .innerJoin(salesMembers, eq(commissions.salesMemberId, salesMembers.id))
    .innerJoin(users, eq(salesMembers.userId, users.id))
    .innerJoin(orders, eq(commissions.orderId, orders.id))
    .where(eq(commissions.status, 'approved'))
    .orderBy(desc(commissions.createdAt))
    .limit(20)

  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Commissions</h1>
        <p className="text-slate-500 mt-1">{pending.length} pending approval</p>
      </div>

      {/* Pending */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-amber-500" />
            Pending Approval
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pending.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">No pending commissions.</p>
          ) : (
            <div className="space-y-3">
              {pending.map(r => (
                <div key={r.commission.id} className="flex items-center justify-between py-3 border-b last:border-0 gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900">{r.user.name}</p>
                    <p className="text-xs text-slate-400">
                      Order from {new Date(r.order.createdAt).toLocaleDateString()} · Order total: {fmt(parseFloat(r.order.total ?? '0'))}
                    </p>
                    {r.commission.notes && (
                      <p className="text-xs text-slate-500 mt-0.5">{r.commission.notes}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-semibold text-lg text-slate-900">{fmt(parseFloat(r.commission.amount ?? '0'))}</span>
                    <CommissionApproveButton
                      commissionId={r.commission.id}
                      approvedByUserId={session.user.id}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recently approved */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recently Approved</CardTitle>
        </CardHeader>
        <CardContent>
          {recentRows.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">No approved commissions yet.</p>
          ) : (
            <div className="space-y-2">
              {recentRows.map(r => (
                <div key={r.commission.id} className="flex items-center justify-between text-sm py-2 border-b last:border-0">
                  <div>
                    <p className="font-medium text-slate-800">{r.user.name}</p>
                    <p className="text-xs text-slate-400">{new Date(r.commission.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="text-xs text-blue-700 border-blue-300">approved</Badge>
                    <span className="font-semibold">{fmt(parseFloat(r.commission.amount ?? '0'))}</span>
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
