import { eq } from 'drizzle-orm'
import { Calendar, DollarSign, User } from 'lucide-react'
import { requireRole } from '@/lib/auth/session'
import { db } from '@/db'
import { commissionPlans, salesMembers, users } from '@/db/schema'
import { getUserPreferences } from '@/lib/preferences/read'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SimpleProfileForm } from '@/components/profile/SimpleProfileForm'
import { notFound } from 'next/navigation'

export default async function SalesProfilePage() {
  const session = await requireRole('sales_rep', 'sales_manager', 'admin')

  const [member] = await db
    .select({
      member: salesMembers,
      user: {
        id: users.id,
        name: users.name,
        email: users.email,
        phone: users.phone,
        avatarUrl: users.avatarUrl,
        address: users.address,
        city: users.city,
        state: users.state,
        zip: users.zip,
      },
    })
    .from(salesMembers)
    .innerJoin(users, eq(salesMembers.userId, users.id))
    .where(eq(salesMembers.userId, session.user.id))
    .limit(1)

  if (!member) {
    return (
      <div className="py-20 text-center text-slate-500">
        <User className="mx-auto mb-3 h-10 w-10 opacity-30" />
        <p>No sales member profile found.</p>
      </div>
    )
  }

  if (!member.user) notFound()

  const preferences = await getUserPreferences(session.user.id)

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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">My Profile</h1>
        <p className="mt-1 text-muted-foreground">Update your contact details and notification settings for the sales portal.</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_360px]">
        <SimpleProfileForm
          user={{
            id: member.user.id,
            name: member.user.name,
            email: member.user.email,
            phone: member.user.phone,
            avatarUrl: member.user.avatarUrl,
            address: member.user.address,
            city: member.user.city,
            state: member.user.state,
            zip: member.user.zip,
          }}
          preferences={preferences}
        />

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="h-4 w-4 text-slate-400" />
                Sales Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between gap-4 text-sm">
                <span className="text-slate-500">Role status</span>
                <Badge
                  variant="outline"
                  className={`text-xs ${member.member.status === 'active' ? 'border-green-300 text-green-700' : 'text-slate-500'}`}
                >
                  {member.member.status}
                </Badge>
              </div>
              <div className="flex justify-between gap-4 text-sm">
                <span className="text-slate-500">Onboarding</span>
                <Badge variant="outline" className="text-xs capitalize">
                  {member.member.onboardingStatus.replace('_', ' ')}
                </Badge>
              </div>
              {member.member.homeRegion ? (
                <div className="flex justify-between gap-4 text-sm">
                  <span className="text-slate-500">Home region</span>
                  <span className="font-medium text-slate-900">{member.member.homeRegion}</span>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <DollarSign className="h-4 w-4 text-slate-400" />
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

          {member.member.hireDate ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Calendar className="h-4 w-4 text-slate-400" />
                  Employment Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {member.member.hireDate ? (
                  <div className="flex justify-between gap-4 text-sm">
                    <span className="text-slate-500">Hire date</span>
                    <span className="font-medium text-slate-900">{member.member.hireDate}</span>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  )
}
