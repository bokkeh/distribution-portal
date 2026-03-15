import Link from 'next/link'
import { ClipboardList, LogOut, UserCircle } from 'lucide-react'
import { requireFeature } from '@/lib/auth/session'
import { SuperAdminViewSwitcher } from '@/components/layout/SuperAdminViewSwitcher'
import { getBellNotificationsForUser } from '@/lib/notifications/in-app'
import { NotificationBell } from '@/components/notifications/NotificationBell'
import { PortalTopBar } from '@/components/layout/PortalTopBar'

export default async function TasterLayout({ children }: { children: React.ReactNode }) {
  const session = await requireFeature('tastings', 'taster', 'admin')
  const isSuperAdmin = session.user.email?.toLowerCase() === 'alex@ahawc.com'
  const featureFlags = session.user.featureFlags ?? []
  const roles = session.user.roles ?? [session.user.role]
  const canViewProfile = roles.includes('admin') || featureFlags.includes('profile')
  const { notifications, unreadCount } = await getBellNotificationsForUser(session.user.id)

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-slate-900 px-6 py-4 text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/90">
              <ClipboardList className="h-4 w-4" />
            </div>
            <div>
              <p className="font-bold">AHAWC Taster Portal</p>
              <p className="text-xs text-slate-400">Assignments and event details</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <NotificationBell items={notifications} unreadCount={unreadCount} dark />
            <Link href="/taster/tastings" className="text-slate-300 hover:text-white">My Tastings</Link>
            <Link href="/taster/payouts" className="text-slate-300 hover:text-white">My Payouts</Link>
            {canViewProfile ? <Link href="/taster/profile" className="flex items-center gap-2 text-slate-300 hover:text-white"><UserCircle className="h-4 w-4" />Profile</Link> : null}
            <form action="/api/auth/signout" method="post">
              <button className="flex items-center gap-2 text-slate-400 hover:text-white">
                <LogOut className="h-4 w-4" />Sign Out
              </button>
            </form>
          </div>
        </div>
      </nav>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
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
