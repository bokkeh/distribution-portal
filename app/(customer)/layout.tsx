import { requireRole } from '@/lib/auth/session'
import CustomerNav from '@/components/layout/CustomerNav'
import { SuperAdminViewSwitcher } from '@/components/layout/SuperAdminViewSwitcher'
import { getBellNotificationsForUser } from '@/lib/notifications/in-app'
import { PortalTopBar } from '@/components/layout/PortalTopBar'
import { ViewAsProvider } from '@/components/admin/ViewAsProvider'

export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  const session = await requireRole('customer')
  const isSuperAdmin = session.user.email?.toLowerCase() === 'alex@ahawc.com'
  const { notifications, unreadCount } = await getBellNotificationsForUser(session.user.id)
  return (
    <div className="min-h-screen bg-slate-50">
      <ViewAsProvider />
      <CustomerNav cartScopeKey={session.user.id} featureFlags={session.user.featureFlags} roles={session.user.roles} notifications={notifications} unreadCount={unreadCount} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PortalTopBar />
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
