import { requireAdminOrStaff } from '@/lib/auth/session'
import StaffSidebar from '@/components/layout/StaffSidebar'
import TestSmsBar from '@/components/layout/TestSmsBar'
import { SuperAdminViewSwitcher } from '@/components/layout/SuperAdminViewSwitcher'
import { getBellNotificationsForUser } from '@/lib/notifications/in-app'
import { PortalTopBar } from '@/components/layout/PortalTopBar'
import { ViewAsProvider } from '@/components/admin/ViewAsProvider'

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdminOrStaff()
  const isSuperAdmin = session.user.email?.toLowerCase() === 'alex@ahawc.com'
  const { notifications, unreadCount } = await getBellNotificationsForUser(session.user.id)
  return (
    <div className="flex min-h-screen bg-slate-50">
      <ViewAsProvider />
      <StaffSidebar showViewSwitcher={isSuperAdmin} featureFlags={session.user.featureFlags} roles={session.user.roles} notifications={notifications} unreadCount={unreadCount} />
      <main className="flex-1 overflow-auto pt-14 md:pt-0">
        <TestSmsBar />
        <div className="p-4 sm:p-8">
          <PortalTopBar />
          {children}
        </div>
      </main>
      {isSuperAdmin ? (
        <div className="fixed bottom-40 left-4 z-40 md:hidden">
          <SuperAdminViewSwitcher />
        </div>
      ) : null}
    </div>
  )
}
