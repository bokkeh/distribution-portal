'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Truck, Map, Menu, UserCircle, X, LogOut } from 'lucide-react'
import { signOut } from 'next-auth/react'
import { NotificationBell } from '@/components/notifications/NotificationBell'
import { DriverSignOutButton } from '@/components/layout/DriverSignOutButton'
import { cn } from '@/lib/utils'

type NotificationItem = {
  id: string
  kind: string
  title: string
  body: string
  href: string | null
  readAt: string | Date | null
  createdAt: string | Date
}

type DriverNavItem = {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

function DriverNavLinks({
  items,
  pathname,
  onNavigate,
}: {
  items: DriverNavItem[]
  pathname: string
  onNavigate?: () => void
}) {
  return (
    <>
      {items.map(({ href, label, icon: Icon }) => {
        const baseHref = href.split('#')[0]
        const active = pathname === baseHref || pathname.startsWith(baseHref + '/')

        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
              active
                ? 'bg-white text-slate-950 md:bg-slate-900 md:text-white'
                : 'text-slate-200 hover:bg-slate-900 hover:text-white md:text-slate-300'
            )}
          >
            <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-blue-400 md:text-white' : 'text-slate-400')} />
            {label}
          </Link>
        )
      })}
    </>
  )
}

export function DriverNav({
  notifications,
  unreadCount,
  canViewDashboard,
  canViewDeliveries,
  canViewMap,
  canViewProfile,
}: {
  notifications: NotificationItem[]
  unreadCount: number
  canViewDashboard: boolean
  canViewDeliveries: boolean
  canViewMap: boolean
  canViewProfile: boolean
}) {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [menuOpen])

  const navItems: DriverNavItem[] = [
    ...(canViewDashboard ? [{ href: '/driver/dashboard', label: 'Dashboard', icon: LayoutDashboard }] : []),
    ...(canViewDeliveries ? [{ href: '/driver/deliveries#current-deliveries', label: 'Deliveries', icon: Truck }] : []),
    ...(canViewMap ? [{ href: '/driver/map', label: 'Map', icon: Map }] : []),
    ...(canViewProfile ? [{ href: '/driver/profile', label: 'Profile', icon: UserCircle }] : []),
  ]

  return (
    <>
      <nav className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/95 text-white backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/driver/dashboard" className="flex min-w-0 items-center gap-3">
            <Image
              src="/brand/logo.png"
              alt="AHAWC"
              width={32}
              height={32}
              className="h-8 w-8 rounded-lg bg-white object-contain p-0.5"
              priority
            />
            <div className="min-w-0">
              <span className="block truncate font-bold">AHAWC Driver Portal</span>
              <span className="block truncate text-xs text-slate-400">Route execution, proof capture, and delivery prep</span>
            </div>
          </Link>

          <div className="hidden items-center gap-1 sm:flex">
            <NotificationBell items={notifications} unreadCount={unreadCount} dark />
            <DriverNavLinks items={navItems} pathname={pathname} />
            <DriverSignOutButton />
          </div>

          <div className="flex items-center gap-2 sm:hidden">
            <NotificationBell items={notifications} unreadCount={unreadCount} dark />
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="rounded-xl p-2 text-slate-300 transition-colors hover:bg-slate-900 hover:text-white"
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
      </nav>

      {menuOpen ? (
        <div className="fixed inset-0 z-50 flex sm:hidden">
          <aside className="flex w-72 max-w-[86vw] flex-col bg-slate-950 text-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
              <div className="flex items-center gap-3">
                <Image
                  src="/brand/logo.png"
                  alt="AHAWC"
                  width={36}
                  height={36}
                  className="h-9 w-9 rounded-xl bg-white object-contain p-0.5"
                />
                <div>
                  <p className="text-sm font-bold">AHAWC</p>
                  <p className="text-xs text-slate-400">Driver Portal</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="rounded-xl p-2 text-slate-300 transition-colors hover:bg-slate-900 hover:text-white"
                aria-label="Close navigation menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="border-b border-slate-800 px-5 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-400">Navigation</p>
            </div>

            <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-3">
              <DriverNavLinks items={navItems} pathname={pathname} onNavigate={() => setMenuOpen(false)} />
            </nav>

            <div className="border-t border-slate-800 p-3">
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-900 hover:text-white"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            </div>
          </aside>

          <button
            type="button"
            className="flex-1 bg-black/50 backdrop-blur-sm"
            onClick={() => setMenuOpen(false)}
            aria-label="Close navigation menu"
          />
        </div>
      ) : null}
    </>
  )
}
