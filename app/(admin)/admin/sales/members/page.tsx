import { requireAdmin } from '@/lib/auth/session'
import { getSalesMembers } from '@/actions/sales-members'
import { db } from '@/db'
import { customerAccounts, commissions } from '@/db/schema'
import { eq, count, sum } from 'drizzle-orm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Users, Plus, DollarSign, Building2 } from 'lucide-react'
import Link from 'next/link'

export default async function SalesMembersPage() {
  await requireAdmin()

  const members = await getSalesMembers()

  // Per-member stats
  const stats = await Promise.all(
    members.map(async m => {
      const [acctCount] = await db
        .select({ count: count() })
        .from(customerAccounts)
        .where(eq(customerAccounts.assignedSalesRepId, m.id))

      const [pendingComm] = await db
        .select({ total: sum(commissions.amount) })
        .from(commissions)
        .where(eq(commissions.salesMemberId, m.id))

      return {
        memberId: m.id,
        accountCount: acctCount?.count ?? 0,
        totalCommissions: parseFloat(pendingComm?.total ?? '0'),
      }
    })
  )

  const statMap = Object.fromEntries(stats.map(s => [s.memberId, s]))
  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Sales Team Members</h1>
          <p className="text-slate-500 mt-1">{members.length} members</p>
        </div>
        <Link href="/admin/sales/members/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Add Member
          </Button>
        </Link>
      </div>

      {members.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-slate-400">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>No sales team members yet.</p>
            <Link href="/admin/sales/members/new">
              <Button variant="outline" className="mt-4">Add First Member</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {members.map(m => {
            const s = statMap[m.id]
            return (
              <Link key={m.id} href={`/admin/sales/members/${m.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="py-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                        <span className="text-sm font-bold text-blue-700">
                          {m.user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-slate-900">{m.user.name}</p>
                          <Badge
                            variant="outline"
                            className={`text-xs ${
                              m.status === 'active' ? 'text-green-700 border-green-300' :
                              m.status === 'inactive' ? 'text-amber-700 border-amber-300' :
                              'text-red-700 border-red-300'
                            }`}
                          >
                            {m.status}
                          </Badge>
                          <Badge variant="outline" className="text-xs text-slate-500">
                            {m.user.role.replace('_', ' ')}
                          </Badge>
                        </div>
                        <p className="text-sm text-slate-500">{m.user.email}</p>
                      </div>
                      <div className="hidden sm:flex items-center gap-6 text-sm text-slate-600">
                        <div className="text-center">
                          <div className="flex items-center gap-1 text-slate-400 text-xs mb-0.5">
                            <Building2 className="w-3 h-3" /> Accounts
                          </div>
                          <p className="font-semibold text-slate-900">{s?.accountCount ?? 0}</p>
                        </div>
                        <div className="text-center">
                          <div className="flex items-center gap-1 text-slate-400 text-xs mb-0.5">
                            <DollarSign className="w-3 h-3" /> Commissions
                          </div>
                          <p className="font-semibold text-slate-900">{fmt(s?.totalCommissions ?? 0)}</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
