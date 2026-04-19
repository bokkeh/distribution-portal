import { requireFeature } from '@/lib/auth/session'
import { getBellNotificationsForUser } from '@/lib/notifications/in-app'
import { PortalTopBar } from '@/components/layout/PortalTopBar'
import { TasterSidebar } from '@/components/layout/TasterSidebar'
import { ViewAsProvider } from '@/components/admin/ViewAsProvider'

export default async function TasterLayout({ children }: { children: React.ReactNode }) {
  const session = await requireFeature('tastings', 'taster', 'admin')
  const isSuperAdmin = session.user.email?.toLowerCase() === 'alex@ahawc.com'
  const featureFlags = session.user.featureFlags ?? []
  const roles = session.user.roles ?? [session.user.role]
  const canViewProfile = roles.includes('admin') || featureFlags.includes('profile')
  const { notifications, unreadCount } = await getBellNotificationsForUser(session.user.id)

  return (
    <div className="min-h-screen bg-slate-50">
      <ViewAsProvider />
      <TasterSidebar
        showViewSwitcher={isSuperAdmin}
        showProfile={canViewProfile}
        notifications={notifications}
        unreadCount={unreadCount}
      />
      <main className="mx-auto max-w-6xl px-4 py-8 pt-20 sm:px-6 md:pt-8 lg:px-8">
        <PortalTopBar />
        {children}
      </main>
    </div>
  )
}
