import { requireRole } from '@/lib/auth/session'
import { db } from '@/db'
import { salesMembers, commissionPlans, users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { User, DollarSign, Calendar } from 'lucide-react'

export default async function SalesProfilePage() {
  const session = await requireRole('sales_rep', 'sales_manager', 'admin')

  const [member] = await db
    .select({
      member: salesMembers,
      user: { id: users.id, name: users.name, email: users.email, phone: users.phone },
    })
    .from(salesMembers)
    .innerJoin(users, eq(salesMembers.userId, users.id))
    .where(eq(salesMembers.userId, session.user.id))
    .limit(1)

  if (!member) {
    return (
      <div className="text-center py-20 text-slate-500">
        <User className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p>No sales member profile found.</p>
      </div>
    )
  }

  let planName: string | null = null
  if (member.member.commissionPlanId) {
    const [plan] = await db
      .select({ name: commissionPlans.name, type: commissionPlans.type })
      .from(commissionPlans)
      .where(eq(commissionPlans.id, member.member.commissionPlanId))
      .limit(1)
    planName = plan ? `${plan.name} (${plan.type.replace('_', ' ')})` : null
  }

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">My Profile</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="w-4 h-4 text-slate-400" />
            Account Info
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Name</span>
            <span className="font-medium">{member.user.name}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Email</span>
            <span className="font-medium">{member.user.email}</span>
          </div>
          {member.user.phone && (
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Phone</span>
              <span className="font-medium">{member.user.phone}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Status</span>
            <Badge
              variant="outline"
              className={`text-xs ${member.member.status === 'active' ? 'text-green-700 border-green-300' : 'text-slate-500'}`}
            >
              {member.member.status}
            </Badge>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Onboarding</span>
            <Badge variant="outline" className="text-xs capitalize">
              {member.member.onboardingStatus.replace('_', ' ')}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-slate-400" />
            Commission Plan
          </CardTitle>
        </CardHeader>
        <CardContent>
          {planName ? (
            <p className="text-sm font-medium text-slate-800">{planName}</p>
          ) : (
            <p className="text-sm text-slate-400">No commission plan assigned. Contact your manager.</p>
          )}
        </CardContent>
      </Card>

      {(member.member.hireDate || member.member.homeRegion) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400" />
              Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {member.member.hireDate && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Hire Date</span>
                <span className="font-medium">{member.member.hireDate}</span>
              </div>
            )}
            {member.member.homeRegion && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Home Region</span>
                <span className="font-medium">{member.member.homeRegion}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
