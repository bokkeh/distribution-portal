import { requireRole } from '@/lib/auth/session'
import Link from 'next/link'
import Image from 'next/image'
import { Truck, Map, UserCircle } from 'lucide-react'
import { SuperAdminViewSwitcher } from '@/components/layout/SuperAdminViewSwitcher'
import { hasFeature } from '@/lib/users/features'
import { getBellNotificationsForUser } from '@/lib/notifications/in-app'
import { NotificationBell } from '@/components/notifications/NotificationBell'
import { PortalTopBar } from '@/components/layout/PortalTopBar'
import { DriverSignOutButton } from '@/components/layout/DriverSignOutButton'

export default async function DriverLayout({ children }: { children: React.ReactNode }) {
  const session = await requireRole('driver', 'admin')
  const isSuperAdmin = session.user.email?.toLowerCase() === 'alex@ahawc.com'
  const roles = session.user.roles ?? [session.user.role]
  const featureFlags = session.user.featureFlags ?? []
  const { notifications, unreadCount } = await getBellNotificationsForUser(session.user.id)
  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/95 text-white backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Image
              src="/brand/logo.png"
              alt="AHAWC"
              width={32}
              height={32}
              className="h-8 w-8 rounded-lg bg-white object-contain p-0.5"
            />
            <div>
              <span className="block font-bold">AHAWC Driver Portal</span>
              <span className="block text-xs text-slate-400">Route execution, proof capture, and delivery prep</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1 sm:gap-2">
            <NotificationBell items={notifications} unreadCount={unreadCount} dark />
            {hasFeature('deliveries', roles, featureFlags) ? (
              <Link href="/driver/deliveries" className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-slate-900 hover:text-white">
                <Truck className="w-4 h-4" />Deliveries
              </Link>
            ) : null}
            {hasFeature('map', roles, featureFlags) ? (
              <Link href="/driver/map" className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-slate-900 hover:text-white">
                <Map className="w-4 h-4" />Map
              </Link>
            ) : null}
            {hasFeature('profile', roles, featureFlags) ? (
              <Link href="/driver/profile" className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-slate-900 hover:text-white">
                <UserCircle className="w-4 h-4" />Profile
              </Link>
            ) : null}
            <DriverSignOutButton />
          </div>
        </div>
      </nav>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
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
