'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, FileText, BookOpen, Users, Package,
  Truck, Map, Building2, LogOut, ChevronRight, Menu, X, UserCircle, CalendarDays, MessageSquare, HeartPulse, ListChecks, ClipboardList, Workflow,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { signOut } from 'next-auth/react'
import { SuperAdminViewSwitcher } from './SuperAdminViewSwitcher'
import type { FeatureKey } from '@/lib/users/features'
import { hasFeature } from '@/lib/users/features'
import { NotificationBell } from '@/components/notifications/NotificationBell'

const navSections = [
  {
    title: 'Overview',
    items: [
      { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard, feature: 'dashboard' },
      { href: '/admin/attention', label: 'Needs Attention', icon: ClipboardList, feature: 'dashboard' },
      { href: '/admin/automations', label: 'Automations', icon: Workflow, feature: 'dashboard' },
    ],
  },
  {
    title: 'Sales & Orders',
    items: [
      { href: '/admin/orders', label: 'Orders', icon: FileText, feature: 'orders' },
      { href: '/admin/deliveries', label: 'Deliveries', icon: Truck, feature: 'deliveries' },
      { href: '/admin/invoicing', label: 'Invoicing', icon: FileText, feature: 'invoicing' },
      { href: '/admin/wholesale-requests', label: 'Wholesaler Requests', icon: FileText, feature: 'wholesale_requests' },
    ],
  },
  {
    title: 'Operations',
    items: [
      { href: '/admin/drivers', label: 'Drivers', icon: Map, feature: 'drivers' },
      { href: '/admin/inventory', label: 'Inventory', icon: Package, feature: 'inventory' },
      { href: '/admin/jobs', label: 'Jobs / Logs', icon: ListChecks, feature: 'dashboard' },
      { href: '/admin/tastings', label: 'Tastings', icon: CalendarDays, feature: 'tastings' },
    ],
  },
  {
    title: 'Customers',
    items: [
      { href: '/admin/crm', label: 'CRM / Accounts', icon: Building2, feature: 'crm' },
      { href: '/admin/inbox', label: 'SMS Inbox', icon: MessageSquare, feature: 'inbox' },
    ],
  },
  {
    title: 'Finance',
    items: [
      { href: '/admin/accounts', label: 'Chart of Accounts', icon: BookOpen, feature: 'accounting' },
    ],
  },
  {
    title: 'Admin',
    items: [
      { href: '/admin/users', label: 'User Management', icon: Users, feature: 'users' },
      { href: '/admin/system', label: 'System Health', icon: HeartPulse, feature: 'dashboard' },
      { href: '/admin/profile', label: 'My Profile', icon: UserCircle, feature: 'profile' },
    ],
  },
]

function NavLinks({
  pathname,
  featureFlags,
  roles,
  navCounts,
  onNav,
}: {
  pathname: string
  featureFlags: string[]
  roles: string[]
  navCounts?: Partial<Record<string, number>>
  onNav?: () => void
}) {
  return (
    <>
      {navSections.map(section => {
        const items = section.items.filter(item => hasFeature(item.feature as FeatureKey, roles, featureFlags))
        if (items.length === 0) return null

        return (
          <div key={section.title} className="space-y-1.5">
            <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              {section.title}
            </p>
            {items.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + '/')
              const count = navCounts?.[href] ?? 0
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={onNav}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                    active
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  )}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  {label}
                  {(count > 0 || active) && (
                    <span className="ml-auto flex items-center gap-2">
                      {count > 0 && (
                        <span
                          className={cn(
                            'inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-semibold',
                            active ? 'bg-white/20 text-white' : 'bg-red-500 text-white'
                          )}
                        >
                          {count > 99 ? '99+' : count}
                        </span>
                      )}
                      {active && <ChevronRight className="w-3.5 h-3.5" />}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        )
      })}
    </>
  )
}

export default function AdminSidebar({
  showViewSwitcher = false,
  featureFlags = [],
  roles = [],
  notifications = [],
  unreadCount = 0,
  navCounts = {},
}: {
  showViewSwitcher?: boolean
  featureFlags?: string[]
  roles?: string[]
  notifications?: Array<{ id: string; kind: string; title: string; body: string; href: string | null; readAt: string | Date | null; createdAt: string | Date }>
  unreadCount?: number
  navCounts?: Partial<Record<string, number>>
}) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  // Close drawer on route change
  useEffect(() => { setOpen(false) }, [pathname])

  // Lock body scroll when drawer is open
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
                <p className="text-xs text-slate-400">Admin Portal</p>
              </div>
            </div>
            <NotificationBell items={notifications} unreadCount={unreadCount} dark />
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          <NavLinks pathname={pathname} featureFlags={featureFlags} roles={roles} navCounts={navCounts} />
        </nav>
        <div className="p-4 border-t border-slate-700">
          {showViewSwitcher && <div className="mb-4"><SuperAdminViewSwitcher compact /></div>}
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </aside>

      {/* ── Mobile top bar ──────────────────────────────────── */}
      <header className="md:hidden fixed top-0 inset-x-0 z-40 flex items-center justify-between bg-slate-900 px-4 h-14 shadow-lg">
        <div className="flex items-center gap-2.5">
          <Image src="/brand/logo.png" alt="AHAWC" width={32} height={32}
            className="h-8 w-8 rounded-md bg-white p-0.5 object-contain" priority />
          <div>
            <p className="font-bold text-white text-sm leading-none">AHAWC</p>
            <p className="text-xs text-slate-400 leading-none mt-0.5">Admin Portal</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell items={notifications} unreadCount={unreadCount} dark />
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
          {/* Drawer panel */}
          <aside className="w-72 max-w-[85vw] bg-slate-900 text-slate-100 flex flex-col shadow-2xl animate-in slide-in-from-left duration-200">
            <div className="flex items-center justify-between p-5 border-b border-slate-700">
              <div className="flex items-center gap-2.5">
                <Image src="/brand/logo.png" alt="AHAWC" width={36} height={36}
                  className="h-9 w-9 rounded-lg bg-white p-0.5 object-contain" />
                <div>
                  <p className="font-bold text-white text-sm">AHAWC</p>
                  <p className="text-xs text-slate-400">Admin Portal</p>
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
              <NavLinks pathname={pathname} featureFlags={featureFlags} roles={roles} navCounts={navCounts} onNav={() => setOpen(false)} />
            </nav>

            <div className="p-4 border-t border-slate-700">
              {showViewSwitcher && <div className="mb-4"><SuperAdminViewSwitcher compact /></div>}
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
              >
                <LogOut className="w-4 h-4" /> Sign Out
              </button>
            </div>
          </aside>

          {/* Backdrop */}
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
