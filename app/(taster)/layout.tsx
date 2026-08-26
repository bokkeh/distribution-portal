import { requireFeature } from '@/lib/auth/session'
import { getBellNotificationsForUser } from '@/lib/notifications/in-app'
import { PortalTopBar } from '@/components/layout/PortalTopBar'
import { TasterSidebar } from '@/components/layout/TasterSidebar'
import { ViewAsProvider } from '@/components/admin/ViewAsProvider'
import { auth } from '@/lib/auth/config'

export default async function TasterLayout({ children }: { children: React.ReactNode }) {
  const session = await requireFeature('tastings', 'taster', 'admin')
  const [identitySession, { notifications, unreadCount }] = await Promise.all([
    auth(),
    getBellNotificationsForUser(session.user.id),
  ])
  const identityUser = identitySession?.user ?? session.user
  const canSwitchViews = (identityUser.roles ?? [identityUser.role]).includes('admin')

  return (
    <div className="min-h-screen bg-slate-50">
      <ViewAsProvider />
      <TasterSidebar
        notifications={notifications}
        unreadCount={unreadCount}
        userName={identityUser.name}
        userAvatarUrl={identityUser.image}
        canSwitchViews={canSwitchViews}
      />
      <main className="mx-auto max-w-6xl px-4 py-8 pt-20 sm:px-6 md:pt-8 lg:px-8">
        <PortalTopBar />
        {children}
      </main>
    </div>
  )
}
