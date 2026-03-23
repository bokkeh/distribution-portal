'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CalendarDays, CalendarCheck, ChevronRight, FileText, LayoutDashboard, LogOut, Menu, UserCircle, Wallet, X } from 'lucide-react'
import { signOut } from 'next-auth/react'
import { cn } from '@/lib/utils'
import { NotificationBell } from '@/components/notifications/NotificationBell'
import { SuperAdminViewSwitcher } from '@/components/layout/SuperAdminViewSwitcher'

type NotificationItem = {
  id: string
  kind: string
  title: string
  body: string
  href: string | null
  readAt: string | Date | null
  createdAt: string | Date
}

const navItems = [
  { href: '/taster/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/taster/tastings', label: 'My Tastings', icon: CalendarDays },
  { href: '/taster/availability', label: 'My Availability', icon: CalendarCheck },
  { href: '/taster/tastings/reports', label: 'Reports', icon: FileText },
  { href: '/taster/payouts', label: 'My Payouts', icon: Wallet },
] as const

function NavLinks({
  pathname,
  showProfile,
  onNav,
}: {
  pathname: string
  showProfile: boolean
  onNav?: () => void
}) {
  return (
    <>
      {navItems.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`)
        return (
          <Link
            key={href}
            href={href}
            onClick={onNav}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
              active
                ? 'bg-blue-600 text-white'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white',
            )}
          >
            <Icon className="h-4 w-4 flex-shrink-0" />
            {label}
            {active ? <ChevronRight className="ml-auto h-3.5 w-3.5" /> : null}
          </Link>
        )
      })}
      {showProfile ? (
        <Link
          href="/taster/profile"
          onClick={onNav}
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
            pathname === '/taster/profile' || pathname.startsWith('/taster/profile/')
              ? 'bg-blue-600 text-white'
              : 'text-slate-300 hover:bg-slate-800 hover:text-white',
          )}
        >
          <UserCircle className="h-4 w-4 flex-shrink-0" />
          Profile
          {pathname === '/taster/profile' || pathname.startsWith('/taster/profile/') ? (
            <ChevronRight className="ml-auto h-3.5 w-3.5" />
          ) : null}
        </Link>
      ) : null}
    </>
  )
}

export function TasterSidebar({
  showViewSwitcher = false,
  showProfile = false,
  notifications = [],
  unreadCount = 0,
}: {
  showViewSwitcher?: boolean
  showProfile?: boolean
  notifications?: NotificationItem[]
  unreadCount?: number
}) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  return (
    <>
      <nav className="hidden bg-slate-900 px-6 py-3 text-white md:block">
        <div className="mx-auto flex max-w-6xl items-center gap-6">
          {/* Logo */}
          <div className="flex items-center gap-2.5 shrink-0">
            <Image
              src="/brand/logo.png"
              alt="AHAWC"
              width={32}
              height={32}
              className="h-8 w-8 rounded-lg bg-white object-contain p-0.5"
            />
            <p className="font-bold text-sm leading-none">AHAWC Taster</p>
          </div>

          {/* Nav links */}
          <div className="flex items-center gap-1 flex-1">
            {navItems.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(`${href}/`)
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap',
                    active
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white',
                  )}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  {label}
                </Link>
              )
            })}
          </div>

          {/* Right: bell + profile + sign out */}
          <div className="flex items-center gap-1 shrink-0">
            <NotificationBell items={notifications} unreadCount={unreadCount} dark />
            {showProfile && (
              <Link
                href="/taster/profile"
                className={cn(
                  'rounded-md p-1.5 transition-colors',
                  pathname.startsWith('/taster/profile')
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white',
                )}
                title="Profile"
              >
                <UserCircle className="h-5 w-5" />
              </Link>
            )}
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
              title="Sign Out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </nav>

      <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between bg-slate-900 px-4 shadow-lg md:hidden">
        <div className="flex items-center gap-2.5">
          <Image
            src="/brand/logo.png"
            alt="AHAWC"
            width={32}
            height={32}
            className="h-8 w-8 rounded-md bg-white p-0.5 object-contain"
            priority
          />
          <div>
            <p className="text-sm font-bold leading-none text-white">AHAWC</p>
            <p className="mt-0.5 text-xs leading-none text-slate-400">Taster Portal</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell items={notifications} unreadCount={unreadCount} dark />
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-lg p-2 text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>

      {open ? (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <aside className="flex w-72 max-w-[85vw] flex-col bg-slate-900 text-slate-100 shadow-2xl animate-in slide-in-from-left duration-200">
            <div className="flex items-center justify-between border-b border-slate-700 p-5">
              <div className="flex items-center gap-2.5">
                <Image
                  src="/brand/logo.png"
                  alt="AHAWC"
                  width={36}
                  height={36}
                  className="h-9 w-9 rounded-lg bg-white p-0.5 object-contain"
                />
                <div>
                  <p className="text-sm font-bold text-white">AHAWC</p>
                  <p className="text-xs text-slate-400">Taster Portal</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="flex-1 space-y-1 overflow-y-auto p-4">
              <NavLinks pathname={pathname} showProfile={showProfile} onNav={() => setOpen(false)} />
            </nav>

            <div className="border-t border-slate-700 p-4">
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            </div>
          </aside>

          <div
            className="flex-1 bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
        </div>
      ) : null}

      {/* Floating view switcher for super-admins */}
      {showViewSwitcher && (
        <div className="fixed bottom-4 left-4 z-50 w-52">
          <SuperAdminViewSwitcher compact />
        </div>
      )}
    </>
  )
}
