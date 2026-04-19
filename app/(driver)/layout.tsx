import { requireRole } from '@/lib/auth/session'
import { SuperAdminViewSwitcher } from '@/components/layout/SuperAdminViewSwitcher'
import { hasFeature } from '@/lib/users/features'
import { getBellNotificationsForUser } from '@/lib/notifications/in-app'
import { PortalTopBar } from '@/components/layout/PortalTopBar'
import { DriverNav } from '@/components/layout/DriverNav'
import { ViewAsProvider } from '@/components/admin/ViewAsProvider'

export default async function DriverLayout({ children }: { children: React.ReactNode }) {
  const session = await requireRole('driver', 'admin')
  const isSuperAdmin = session.user.email?.toLowerCase() === 'alex@ahawc.com'
  const roles = session.user.roles ?? [session.user.role]
  const featureFlags = session.user.featureFlags ?? []
  const { notifications, unreadCount } = await getBellNotificationsForUser(session.user.id)
  return (
    <div className="min-h-screen bg-slate-50">
      <ViewAsProvider />
      <DriverNav
        notifications={notifications}
        unreadCount={unreadCount}
        canViewDashboard={hasFeature('deliveries', roles, featureFlags)}
        canViewDeliveries={hasFeature('deliveries', roles, featureFlags)}
        canViewMap={hasFeature('map', roles, featureFlags)}
        canViewProfile={hasFeature('profile', roles, featureFlags)}
      />
      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
        <div className="hidden sm:block">
          <PortalTopBar />
        </div>
        {children}
      </main>
      {isSuperAdmin ? (
        <div className="fixed bottom-4 left-4 z-40">
          <SuperAdminViewSwitcher />
        </div>
      ) : null}
    </div>
  )
}
