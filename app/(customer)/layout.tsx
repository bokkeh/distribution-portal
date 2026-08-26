import { requireRole } from '@/lib/auth/session'
import CustomerNav from '@/components/layout/CustomerNav'
import { getBellNotificationsForUser } from '@/lib/notifications/in-app'
import { PortalTopBar } from '@/components/layout/PortalTopBar'
import { ViewAsProvider } from '@/components/admin/ViewAsProvider'
import { auth } from '@/lib/auth/config'

export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  const session = await requireRole('customer')
  const [identitySession, { notifications, unreadCount }] = await Promise.all([
    auth(),
    getBellNotificationsForUser(session.user.id),
  ])
  const identityUser = identitySession?.user ?? session.user
  const canSwitchViews = (identityUser.roles ?? [identityUser.role]).includes('admin')
  return (
    <div className="min-h-screen bg-slate-50">
      <ViewAsProvider />
      <CustomerNav
        cartScopeKey={session.user.id}
        featureFlags={session.user.featureFlags}
        roles={session.user.roles}
        notifications={notifications}
        unreadCount={unreadCount}
        userName={identityUser.name}
        userAvatarUrl={identityUser.image}
        canSwitchViews={canSwitchViews}
      />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PortalTopBar />
        {children}
      </main>
    </div>
  )
}
