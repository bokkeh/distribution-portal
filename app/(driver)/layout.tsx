import { requireRole } from '@/lib/auth/session'
import { hasFeature } from '@/lib/users/features'
import { getBellNotificationsForUser } from '@/lib/notifications/in-app'
import { PortalTopBar } from '@/components/layout/PortalTopBar'
import { DriverNav } from '@/components/layout/DriverNav'
import { ViewAsProvider } from '@/components/admin/ViewAsProvider'
import { auth } from '@/lib/auth/config'

export default async function DriverLayout({ children }: { children: React.ReactNode }) {
  const session = await requireRole('driver', 'admin')
  const roles = session.user.roles ?? [session.user.role]
  const featureFlags = session.user.featureFlags ?? []
  const [identitySession, { notifications, unreadCount }] = await Promise.all([
    auth(),
    getBellNotificationsForUser(session.user.id),
  ])
  const identityUser = identitySession?.user ?? session.user
  const canSwitchViews = (identityUser.roles ?? [identityUser.role]).includes('admin')
  return (
    <div className="min-h-screen bg-slate-50">
      <ViewAsProvider />
      <DriverNav
        notifications={notifications}
        unreadCount={unreadCount}
        canViewDashboard={hasFeature('deliveries', roles, featureFlags)}
        canViewDeliveries={hasFeature('deliveries', roles, featureFlags)}
        canViewMap={hasFeature('map', roles, featureFlags)}
        userName={identityUser.name}
        userAvatarUrl={identityUser.image}
        canSwitchViews={canSwitchViews}
      />
      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
        <div className="hidden sm:block">
          <PortalTopBar />
        </div>
        {children}
      </main>
    </div>
  )
}
