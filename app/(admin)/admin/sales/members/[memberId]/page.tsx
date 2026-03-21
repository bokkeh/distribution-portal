import { requireAdmin } from '@/lib/auth/session'
import { getSalesMemberById, getAccountsForRep, getCommissionsForMember, getCommissionPlans, getSalesMembers } from '@/actions/sales-members'
import { notFound } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Building2, DollarSign, Calendar, MapPin, User } from 'lucide-react'
import Link from 'next/link'
import { SalesMemberEditForm } from './SalesMemberEditForm'
import { AccountAssignmentPanel } from './AccountAssignmentPanel'

interface Props {
  params: Promise<{ memberId: string }>
}

export default async function SalesMemberDetailPage({ params }: Props) {
  await requireAdmin()
  const { memberId } = await params

  const [member, plans, allMembers] = await Promise.all([
    getSalesMemberById(memberId),
    getCommissionPlans(),
    getSalesMembers(),
  ])

  if (!member) notFound()

  const accounts = await getAccountsForRep(memberId)
  const memberCommissions = await getCommissionsForMember(memberId)

  const managers = allMembers.filter(m => m.id !== memberId)

  const totalPaid = memberCommissions
    .filter(c => c.status === 'paid')
    .reduce((s, c) => s + parseFloat(c.amount ?? '0'), 0)
  const totalPending = memberCommissions
    .filter(c => c.status === 'pending')
    .reduce((s, c) => s + parseFloat(c.amount ?? '0'), 0)
  const totalApproved = memberCommissions
    .filter(c => c.status === 'approved')
    .reduce((s, c) => s + parseFloat(c.amount ?? '0'), 0)

  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/sales/members">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">{member.user.name}</h1>
            <Badge
              variant="outline"
              className={`${
                member.status === 'active' ? 'text-green-700 border-green-300' :
                member.status === 'inactive' ? 'text-amber-700 border-amber-300' :
                'text-red-700 border-red-300'
              }`}
            >
              {member.status}
            </Badge>
          </div>
          <p className="text-slate-500 text-sm">{member.user.email}</p>
        </div>
      </div>

      {/* Commission summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-slate-500 mb-1">Pending</p>
            <p className="text-xl font-bold text-amber-600">{fmt(totalPending)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-slate-500 mb-1">Approved</p>
            <p className="text-xl font-bold text-blue-600">{fmt(totalApproved)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-slate-500 mb-1">Paid Out</p>
            <p className="text-xl font-bold text-green-600">{fmt(totalPaid)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Edit form */}
        <SalesMemberEditForm member={member} plans={plans} managers={managers} />

        {/* Accounts panel */}
        <AccountAssignmentPanel memberId={memberId} accounts={accounts} />
      </div>

      {/* Commission history */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-slate-400" />
            Commission History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {memberCommissions.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">No commissions recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {memberCommissions.map(c => (
                <div key={c.id} className="flex items-center justify-between text-sm py-2 border-b last:border-0">
                  <div>
                    <p className="text-xs text-slate-400">{new Date(c.createdAt).toLocaleDateString()}</p>
                    {c.notes && <p className="text-slate-600 text-xs">{c.notes}</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge
                      variant="outline"
                      className={`text-xs ${
                        c.status === 'paid' ? 'text-green-700 border-green-300' :
                        c.status === 'approved' ? 'text-blue-700 border-blue-300' :
                        c.status === 'voided' ? 'text-slate-400 border-slate-200' :
                        'text-amber-700 border-amber-300'
                      }`}
                    >
                      {c.status}
                    </Badge>
                    <span className="font-semibold text-slate-900">{fmt(parseFloat(c.amount ?? '0'))}</span>
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
