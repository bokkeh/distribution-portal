import { requireAdmin } from '@/lib/auth/session'
import AdminSidebar from '@/components/layout/AdminSidebar'
import TestSmsBar from '@/components/layout/TestSmsBar'
import { getBellNotificationsForUser } from '@/lib/notifications/in-app'
import { PortalTopBar } from '@/components/layout/PortalTopBar'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin()
  const isSuperAdmin = session.user.email?.toLowerCase() === 'alex@ahawc.com'
  const { notifications, unreadCount } = await getBellNotificationsForUser(session.user.id)
  const wholesalerRequestCount = notifications.filter(
    notification => notification.kind === 'wholesale_request' && !notification.readAt
  ).length

  return (
    <div className="flex min-h-screen bg-slate-50">
      <AdminSidebar
        showViewSwitcher={isSuperAdmin}
        featureFlags={session.user.featureFlags}
        roles={session.user.roles}
        notifications={notifications}
        unreadCount={unreadCount}
        navCounts={{ '/admin/wholesale-requests': wholesalerRequestCount }}
      />
      <main className="flex-1 overflow-auto pt-14 md:pt-0">
        <TestSmsBar />
        <div className="p-4 sm:p-8">
          <PortalTopBar />
          {children}
        </div>
      </main>
    </div>
  )
}
