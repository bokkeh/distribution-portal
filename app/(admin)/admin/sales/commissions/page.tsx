import { requireAdmin } from '@/lib/auth/session'
import { getAllCommissions, getSalesMembers } from '@/actions/sales-members'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { DollarSign } from 'lucide-react'
import { ManualCommissionForm } from './ManualCommissionForm'
import { CommissionRowActions } from './CommissionRowActions'

const TYPE_LABELS: Record<string, string> = {
  order_based: 'Order',
  manual_bonus: 'Bonus',
  adjustment: 'Adjustment',
  spiff: 'Spiff',
  penalty: 'Penalty',
}

const TYPE_COLORS: Record<string, string> = {
  manual_bonus: 'text-green-700 border-green-300',
  adjustment: 'text-blue-700 border-blue-300',
  spiff: 'text-purple-700 border-purple-300',
  penalty: 'text-red-700 border-red-300',
  order_based: 'text-slate-600 border-slate-200',
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'text-amber-700 border-amber-300 bg-amber-50',
  approved: 'text-blue-700 border-blue-300 bg-blue-50',
  paid: 'text-green-700 border-green-300 bg-green-50',
  voided: 'text-slate-400 border-slate-200 bg-slate-50',
}

export default async function CommissionsPage() {
  const session = await requireAdmin()

  const [allRows, members] = await Promise.all([
    getAllCommissions(),
    getSalesMembers(),
  ])

  const pending = allRows.filter(r => r.commission.status === 'pending')
  const approved = allRows.filter(r => r.commission.status === 'approved')
  const voided = allRows.filter(r => r.commission.status === 'voided')

  const totalPending = pending.reduce((s, r) => s + parseFloat(r.commission.amount ?? '0'), 0)
  const totalApproved = approved.reduce((s, r) => s + parseFloat(r.commission.amount ?? '0'), 0)

  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)

  function commissionLabel(r: { commission: { type: string; description: string | null; isManual: boolean }; order: { createdAt: Date; total: string | null } | null }) {
    if (r.commission.isManual) {
      return r.commission.description ?? TYPE_LABELS[r.commission.type] ?? r.commission.type
    }
    if (r.order) {
      return `Order · ${new Date(r.order.createdAt).toLocaleDateString()} · ${fmt(parseFloat(r.order.total ?? '0'))}`
    }
    return 'Order'
  }

  function CommissionRow({ r }: { r: typeof allRows[number] }) {
    return (
      <div className="flex items-center justify-between py-3 border-b last:border-0 gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="font-medium text-slate-900 text-sm">{r.user.name}</p>
            <Badge variant="outline" className={`text-xs ${TYPE_COLORS[r.commission.type] ?? 'text-slate-600 border-slate-200'}`}>
              {TYPE_LABELS[r.commission.type] ?? r.commission.type}
            </Badge>
            {r.commission.isManual && (
              <Badge variant="outline" className="text-xs text-violet-700 border-violet-300">Manual</Badge>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">{commissionLabel(r)}</p>
          {r.commission.notes && (
            <p className="text-xs text-slate-500 mt-0.5 italic">{r.commission.notes}</p>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="font-semibold text-slate-900">{fmt(parseFloat(r.commission.amount ?? '0'))}</span>
          <CommissionRowActions
            commissionId={r.commission.id}
            currentAmount={r.commission.amount ?? '0'}
            status={r.commission.status}
            currentUserId={session.user.id}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Commissions</h1>
        <p className="text-slate-500 mt-1">
          {fmt(totalPending)} pending · {fmt(totalApproved)} approved
        </p>
      </div>

      <ManualCommissionForm members={members} currentUserId={session.user.id} />

      {/* Pending */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-amber-500" />
            Pending Approval ({pending.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pending.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">No pending commissions.</p>
          ) : (
            pending.map(r => <CommissionRow key={r.commission.id} r={r} />)
          )}
        </CardContent>
      </Card>

      {/* Approved */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Approved ({approved.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {approved.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">No approved commissions.</p>
          ) : (
            approved.slice(0, 30).map(r => <CommissionRow key={r.commission.id} r={r} />)
          )}
        </CardContent>
      </Card>

      {/* Voided */}
      {voided.length > 0 && (
        <Card className="opacity-70">
          <CardHeader>
            <CardTitle className="text-base text-slate-500">Voided ({voided.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {voided.slice(0, 20).map(r => (
              <div key={r.commission.id} className="flex items-center justify-between py-2 border-b last:border-0 gap-4 text-slate-400">
                <div className="flex-1 min-w-0">
                  <p className="text-sm">{r.user.name} · {commissionLabel(r)}</p>
                </div>
                <span className="text-sm line-through">{fmt(parseFloat(r.commission.amount ?? '0'))}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
