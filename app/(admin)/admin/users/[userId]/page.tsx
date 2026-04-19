import Link from 'next/link'
import { eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { ArrowLeft, LogIn, LogOut } from 'lucide-react'
import { db } from '@/db'
import { customerAccounts, drivers, userFeatureSettings, users } from '@/db/schema'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getRecentUserAccessEvents, getUserAccessSummaryMap } from '@/lib/auth/activity'
import { UserRoleForm } from './user-role-form'
import { UserNotificationPrefsForm } from './user-notification-prefs-form'
import { UserProfileCard } from '@/components/admin/UserProfileCard'
import { TasterRateCard } from '@/components/admin/TasterRateCard'
import { ViewAsButton } from '@/components/admin/ViewAsButton'
import { auth } from '@/lib/auth/config'
import { getUserPreferences } from '@/lib/preferences/read'

function isMissingUserFeatureTable(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()
  return message.includes('user_feature_settings') && message.includes('does not exist')
}

export default async function UserDetailPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params
  const session = await auth()
  const currentUserRoles = session?.user?.roles ?? (session?.user?.role ? [session.user.role] : [])
  const canSwitchView = currentUserRoles.includes('admin')

  const [user] = await db.select({
    id: users.id,
    name: users.name,
    email: users.email,
    phone: users.phone,
    role: users.role,
    roles: users.roles,
    avatarUrl: users.avatarUrl,
    active: users.active,
    tasterHourlyRate: users.tasterHourlyRate,
  }).from(users).where(eq(users.id, userId))
  if (!user) notFound()

  const [account] = await db.select().from(customerAccounts).where(eq(customerAccounts.userId, user.id))
  const [driver] = await db.select().from(drivers).where(eq(drivers.userId, user.id))
  const [accessSummaryMap, accessEvents, prefs] = await Promise.all([
    getUserAccessSummaryMap(),
    getRecentUserAccessEvents(user.id),
    getUserPreferences(user.id),
  ])
  const accessSummary = accessSummaryMap.get(user.id)
  let featureSettings: { features: string[] } | undefined

  try {
    ;[featureSettings] = await db
      .select({ features: userFeatureSettings.features })
      .from(userFeatureSettings)
      .where(eq(userFeatureSettings.userId, user.id))
      .limit(1)
  } catch (error) {
    if (!isMissingUserFeatureTable(error)) throw error
  }

  return (
    <div className="p-4 sm:p-8 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/users"><Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900">{user.name}</h1>
          <p className="text-muted-foreground mt-1">{user.email}</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Badge variant={user.active ? 'success' : 'secondary'}>{user.active ? 'Active' : 'Inactive'}</Badge>
          {canSwitchView ? (
            user.roles.length > 1 ? user.roles.map((role) => (
              <ViewAsButton
                key={role}
                userId={user.id}
                userName={user.name}
                role={role}
                label={`View as ${role.replace('_', ' ')}`}
              />
            )) : (
              <ViewAsButton userId={user.id} userName={user.name} role={user.role} />
            )
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <UserProfileCard
          user={{ id: user.id, name: user.name, email: user.email, phone: user.phone, avatarUrl: user.avatarUrl }}
        />

        <UserRoleForm
          user={{ id: user.id, role: user.role, roles: user.roles, phone: user.phone, active: user.active, featureFlags: featureSettings?.features ?? null }}
          accountId={account?.id}
        />

        <Card>
          <CardHeader><CardTitle>Role Summary</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div><p className="text-muted-foreground">Primary Role</p><Badge variant="outline" className="capitalize">{user.role}</Badge></div>
              <div><p className="text-muted-foreground">Phone</p><p className="font-medium">{user.phone ?? '-'}</p></div>
            </div>
            <div>
              <p className="mb-2 text-muted-foreground">All Roles</p>
              <div className="flex flex-wrap gap-2">
                {user.roles.map(role => <Badge key={role} variant="secondary" className="capitalize">{role}</Badge>)}
              </div>
            </div>
          </CardContent>
        </Card>

        <UserNotificationPrefsForm
          userId={user.id}
          emailNotificationsEnabled={prefs.emailNotificationsEnabled}
          smsNotificationsEnabled={prefs.smsNotificationsEnabled}
          inAppNotificationsEnabled={prefs.inAppNotificationsEnabled}
          notificationPreference={prefs.notificationPreference}
        />

        <Card>
          <CardHeader><CardTitle>Access Activity</CardTitle></CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Most Recent Login</p>
                <p className="mt-2 text-base font-semibold text-slate-900">
                  {accessSummary?.lastLoginAt ? formatDateTime(accessSummary.lastLoginAt) : 'No login recorded'}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Most Recent Logout</p>
                <p className="mt-2 text-base font-semibold text-slate-900">
                  {accessSummary?.lastLogoutAt ? formatDateTime(accessSummary.lastLogoutAt) : 'No logout recorded'}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recent Sessions</p>
              {accessEvents.length ? (
                <div className="space-y-2">
                  {accessEvents.map((event) => (
                    <div key={event.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
                      <div className="flex items-center gap-3">
                        <div className="rounded-full bg-slate-100 p-2 text-slate-600">
                          {event.eventType === 'login' ? <LogIn className="h-4 w-4" /> : <LogOut className="h-4 w-4" />}
                        </div>
                        <div>
                          <p className="font-medium capitalize">{event.eventType}</p>
                          <p className="text-xs text-muted-foreground">{event.provider ? `Provider: ${event.provider}` : 'Provider: session'}</p>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">{formatDateTime(event.createdAt)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200 p-4 text-muted-foreground">
                  Login and logout activity will appear here after the new access tracking migration is live.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {account ? (
          <Card>
            <CardHeader><CardTitle>Customer Account</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-muted-foreground">Company</p><p className="font-medium">{account.companyName}</p></div>
                <div><p className="text-muted-foreground">Terms</p><Badge variant="secondary">{account.paymentTerms}</Badge></div>
                <div><p className="text-muted-foreground">Credit Limit</p><p className="font-medium">${account.creditLimit}</p></div>
                <div><p className="text-muted-foreground">Balance</p><p className="font-medium">${account.balance}</p></div>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {driver ? (
          <Card>
            <CardHeader><CardTitle>Driver Profile</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-muted-foreground">Vehicle</p><p className="font-medium">{[driver.vehicleMake, driver.vehicleModel].filter(Boolean).join(' ') || '-'}</p></div>
                <div><p className="text-muted-foreground">License Plate</p><p className="font-medium">{driver.licensePlate ?? '-'}</p></div>
                <div><p className="text-muted-foreground">Phone</p><p className="font-medium">{driver.phone}</p></div>
                <div><p className="text-muted-foreground">Status</p><Badge variant={driver.active ? 'success' : 'secondary'}>{driver.active ? 'Active' : 'Inactive'}</Badge></div>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {user.roles.includes('taster') && (
          <TasterRateCard userId={user.id} currentRate={user.tasterHourlyRate} />
        )}
      </div>
    </div>
  )
}

function formatDateTime(value: Date | string) {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(typeof value === 'string' ? new Date(value) : value)
}
