import { requireRole } from '@/lib/auth/session'
import Link from 'next/link'
import Image from 'next/image'
import { Truck, Map, LogOut, UserCircle } from 'lucide-react'
import { SuperAdminViewSwitcher } from '@/components/layout/SuperAdminViewSwitcher'
import { hasFeature } from '@/lib/users/features'
import { getBellNotificationsForUser } from '@/lib/notifications/in-app'
import { NotificationBell } from '@/components/notifications/NotificationBell'
import { PortalTopBar } from '@/components/layout/PortalTopBar'

export default async function DriverLayout({ children }: { children: React.ReactNode }) {
  const session = await requireRole('driver', 'admin')
  const isSuperAdmin = session.user.email?.toLowerCase() === 'alex@ahawc.com'
  const roles = session.user.roles ?? [session.user.role]
  const featureFlags = session.user.featureFlags ?? []
  const { notifications, unreadCount } = await getBellNotificationsForUser(session.user.id)
  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Image
            src="/brand/logo.png"
            alt="AHAWC"
            width={32}
            height={32}
            className="h-8 w-8 rounded-lg bg-white object-contain p-0.5"
          />
          <span className="font-bold">AHAWC Driver Portal</span>
        </div>
        <div className="flex items-center gap-4">
          <NotificationBell items={notifications} unreadCount={unreadCount} dark />
          {hasFeature('deliveries', roles, featureFlags) ? (
            <Link href="/driver/deliveries" className="flex items-center gap-2 text-sm text-slate-300 hover:text-white">
              <Truck className="w-4 h-4" />Deliveries
            </Link>
          ) : null}
          {hasFeature('map', roles, featureFlags) ? (
            <Link href="/driver/map" className="flex items-center gap-2 text-sm text-slate-300 hover:text-white">
              <Map className="w-4 h-4" />Map
            </Link>
          ) : null}
          {hasFeature('profile', roles, featureFlags) ? (
            <Link href="/driver/profile" className="flex items-center gap-2 text-sm text-slate-300 hover:text-white">
              <UserCircle className="w-4 h-4" />Profile
            </Link>
          ) : null}
          <form action="/api/auth/signout" method="post">
            <button className="flex items-center gap-2 text-sm text-slate-400 hover:text-white">
              <LogOut className="w-4 h-4" />Sign Out
            </button>
          </form>
        </div>
      </nav>
      <main className="max-w-2xl mx-auto py-8 px-4">
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
