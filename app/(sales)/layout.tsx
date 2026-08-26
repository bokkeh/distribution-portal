import { requireRole } from '@/lib/auth/session'
import SalesNav from '@/components/layout/SalesNav'
import { ViewAsProvider } from '@/components/admin/ViewAsProvider'
import { getBellNotificationsForUser } from '@/lib/notifications/in-app'
import { auth } from '@/lib/auth/config'

export default async function SalesLayout({ children }: { children: React.ReactNode }) {
  const session = await requireRole('sales_rep', 'sales_manager', 'admin')
  const [identitySession, { notifications, unreadCount }] = await Promise.all([
    auth(),
    getBellNotificationsForUser(session.user.id),
  ])
  const identityUser = identitySession?.user ?? session.user
  const canSwitchViews = (identityUser.roles ?? [identityUser.role]).includes('admin')
  return (
    <div className="min-h-screen bg-slate-50">
      <ViewAsProvider />
      <SalesNav
        userName={identityUser.name ?? undefined}
        userAvatarUrl={identityUser.image}
        canSwitchViews={canSwitchViews}
        notifications={notifications}
        unreadCount={unreadCount}
      />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  )
}
