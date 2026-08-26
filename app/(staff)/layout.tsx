import { requireAdminOrStaff } from '@/lib/auth/session'
import StaffSidebar from '@/components/layout/StaffSidebar'
import TestSmsBar from '@/components/layout/TestSmsBar'
import { getBellNotificationsForUser } from '@/lib/notifications/in-app'
import { PortalTopBar } from '@/components/layout/PortalTopBar'
import { ViewAsProvider } from '@/components/admin/ViewAsProvider'
import { auth } from '@/lib/auth/config'

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdminOrStaff()
  const [identitySession, { notifications, unreadCount }] = await Promise.all([
    auth(),
    getBellNotificationsForUser(session.user.id),
  ])
  const identityUser = identitySession?.user ?? session.user
  const canSwitchViews = (identityUser.roles ?? [identityUser.role]).includes('admin')
  return (
    <div className="flex min-h-screen bg-slate-50">
      <ViewAsProvider />
      <StaffSidebar
        featureFlags={session.user.featureFlags}
        roles={session.user.roles}
        notifications={notifications}
        unreadCount={unreadCount}
        userName={identityUser.name}
        userAvatarUrl={identityUser.image}
        canSwitchViews={canSwitchViews}
      />
      <main className="flex-1 overflow-auto pt-14 md:pt-0">
        <TestSmsBar />
        <PortalTopBar
          operational
          notifications={notifications}
          unreadCount={unreadCount}
          userName={identityUser.name}
          userAvatarUrl={identityUser.image}
          profileHref={canSwitchViews ? '/admin/profile' : '/staff/profile'}
          canSwitchViews={canSwitchViews}
        />
        <div className="p-4 sm:p-8">
          {children}
        </div>
      </main>
    </div>
  )
}
