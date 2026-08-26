'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, ShoppingCart, Building2, Package,
  ChevronRight, Menu, X, CalendarDays, MessageSquare, FileText, Gauge,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FeatureKey } from '@/lib/users/features'
import { hasFeature } from '@/lib/users/features'
import { NotificationBell } from '@/components/notifications/NotificationBell'
import { PortalProfileMenu } from '@/components/layout/PortalProfileMenu'

const navItems = [
  { href: '/staff/dashboard', label: 'Dashboard', icon: LayoutDashboard, feature: 'dashboard' },
  { href: '/staff/orders',    label: 'Orders',    icon: ShoppingCart, feature: 'orders' },
  { href: '/staff/invoicing', label: 'Invoicing', icon: FileText, feature: 'invoicing' },
  { href: '/staff/crm',       label: 'Accounts',  icon: Building2, feature: 'crm' },
  { href: '/staff/pull-through', label: 'Pull-Through', icon: Gauge, feature: 'crm' },
  { href: '/staff/inbox',     label: 'SMS Inbox', icon: MessageSquare, feature: 'inbox' },
  { href: '/staff/inventory', label: 'Inventory', icon: Package, feature: 'inventory' },
  { href: '/staff/sample-inventory', label: 'Sample Inventory', icon: Package, feature: 'inventory' },
  { href: '/staff/tastings',  label: 'Tastings',  icon: CalendarDays, feature: 'tastings' },
]

function NavLinks({
  pathname,
  featureFlags,
  roles,
  onNav,
}: {
  pathname: string
  featureFlags: string[]
  roles: string[]
  onNav?: () => void
}) {
  return (
    <>
      {navItems.filter(item => hasFeature(item.feature as FeatureKey, roles, featureFlags)).map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + '/')
        return (
          <Link
            key={href}
            href={href}
            onClick={onNav}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
              active
                ? 'bg-green-600 text-white'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            )}
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            {label}
            {active && <ChevronRight className="w-3.5 h-3.5 ml-auto" />}
          </Link>
        )
      })}
    </>
  )
}

export default function StaffSidebar({
  featureFlags = [],
  roles = [],
  notifications = [],
  unreadCount = 0,
  userName,
  userAvatarUrl,
  canSwitchViews = false,
}: {
  featureFlags?: string[]
  roles?: string[]
  notifications?: Array<{ id: string; kind: string; title: string; body: string; href: string | null; readAt: string | Date | null; createdAt: string | Date }>
  unreadCount?: number
  userName?: string | null
  userAvatarUrl?: string | null
  canSwitchViews?: boolean
}) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  return (
    <>
      {/* ── Desktop sidebar ─────────────────────────────────── */}
      <aside className="hidden md:flex w-64 min-h-screen bg-slate-900 text-slate-100 flex-col flex-shrink-0">
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Image src="/brand/logo.png" alt="AHAWC" width={40} height={40}
                className="h-10 w-10 rounded-lg bg-white p-1 object-contain" priority />
              <div>
                <p className="font-bold text-white">AHAWC</p>
                <p className="text-xs text-slate-400">Staff Portal</p>
              </div>
            </div>
            <NotificationBell items={notifications} unreadCount={unreadCount} dark />
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          <NavLinks pathname={pathname} featureFlags={featureFlags} roles={roles} />
        </nav>
      </aside>

      {/* ── Mobile top bar ──────────────────────────────────── */}
      <header className="md:hidden fixed top-0 inset-x-0 z-40 flex items-center justify-between bg-slate-900 px-4 h-14 shadow-lg">
        <div className="flex items-center gap-2.5">
          <Image src="/brand/logo.png" alt="AHAWC" width={32} height={32}
            className="h-8 w-8 rounded-md bg-white p-0.5 object-contain" priority />
          <div>
            <p className="font-bold text-white text-sm leading-none">AHAWC</p>
            <p className="text-xs text-slate-400 leading-none mt-0.5">Staff Portal</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell items={notifications} unreadCount={unreadCount} dark />
          <PortalProfileMenu
            userName={userName}
            userAvatarUrl={userAvatarUrl}
            profileHref={canSwitchViews ? '/admin/profile' : '/staff/profile'}
            canSwitchViews={canSwitchViews}
          />
          <button
            onClick={() => setOpen(true)}
            className="p-2 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* ── Mobile drawer overlay ───────────────────────────── */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <aside className="w-72 max-w-[85vw] bg-slate-900 text-slate-100 flex flex-col shadow-2xl animate-in slide-in-from-left duration-200">
            <div className="flex items-center justify-between p-5 border-b border-slate-700">
              <div className="flex items-center gap-2.5">
                <Image src="/brand/logo.png" alt="AHAWC" width={36} height={36}
                  className="h-9 w-9 rounded-lg bg-white p-0.5 object-contain" />
                <div>
                  <p className="font-bold text-white text-sm">AHAWC</p>
                  <p className="text-xs text-slate-400">Staff Portal</p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
              <NavLinks pathname={pathname} featureFlags={featureFlags} roles={roles} onNav={() => setOpen(false)} />
            </nav>

          </aside>

          <div
            className="flex-1 bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
        </div>
      )}
    </>
  )
}
