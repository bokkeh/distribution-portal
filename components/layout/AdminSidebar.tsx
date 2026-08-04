'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, FileText, BookOpen, Users, Package,
  Truck, Building2, LogOut, ChevronRight, Menu, X, UserCircle, CalendarDays, MessageSquare, HeartPulse, ClipboardList, Workflow, BarChart3, TrendingUp, UserCheck, DollarSign, Globe, Receipt, ShoppingCart, Star, Cpu, Activity,
  Newspaper,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { signOut } from 'next-auth/react'
import { SuperAdminViewSwitcher } from './SuperAdminViewSwitcher'
import type { FeatureKey } from '@/lib/users/features'
import { hasFeature } from '@/lib/users/features'
import { NotificationBell } from '@/components/notifications/NotificationBell'
import { DialpadButton, DialpadSidebar } from '@/components/admin/DialpadSidebar'
import { CommandPalette } from '@/components/ui/command-palette'

const SECTION_COLORS: Record<string, { border: string; label: string; dot: string }> = {
  'Overview':       { border: 'border-blue-400',   label: 'text-blue-600',   dot: 'bg-blue-400' },
  'Sales & Orders': { border: 'border-emerald-400', label: 'text-emerald-600', dot: 'bg-emerald-400' },
  'Operations':     { border: 'border-amber-400',   label: 'text-amber-600',  dot: 'bg-amber-400' },
  'Customers':      { border: 'border-violet-400',  label: 'text-violet-600', dot: 'bg-violet-400' },
  'Finance':        { border: 'border-rose-400',    label: 'text-rose-600',   dot: 'bg-rose-400' },
  'Sales Team':     { border: 'border-cyan-400',    label: 'text-cyan-600',   dot: 'bg-cyan-400' },
  'Admin':          { border: 'border-slate-400',   label: 'text-slate-500',  dot: 'bg-slate-400' },
}

const navSections = [
  {
    title: 'Overview',
    items: [
      { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard, feature: 'dashboard' },
      { href: '/admin/attention', label: 'Needs Attention', icon: Activity, feature: 'dashboard' },
      { href: '/admin/news', label: 'Industry News', icon: Newspaper, feature: 'dashboard' },
    ],
  },
  {
    title: 'Sales & Orders',
    items: [
      { href: '/admin/orders', label: 'Orders', icon: ShoppingCart, feature: 'orders' },
      { href: '/sales/orders/assisted', label: 'Assisted Orders', icon: ClipboardList, feature: 'orders' },
      { href: '/admin/deliveries', label: 'Deliveries', icon: Truck, feature: 'deliveries' },
      { href: '/admin/deliveries/reports', label: 'Delivery Reports', icon: BarChart3, feature: 'deliveries' },
      { href: '/admin/deliveries/performance', label: 'Driver Performance', icon: TrendingUp, feature: 'deliveries' },
      { href: '/admin/invoicing', label: 'Invoicing', icon: Receipt, feature: 'invoicing' },
      { href: '/admin/wholesale-requests', label: 'Wholesaler Requests', icon: Star, feature: 'wholesale_requests' },
    ],
  },
  {
    title: 'Operations',
    items: [
      { href: '/admin/inventory', label: 'Inventory', icon: Package, feature: 'inventory' },
      { href: '/admin/sample-inventory', label: 'Sample Inventory', icon: ClipboardList, feature: 'inventory' },
      { href: '/admin/pricing', label: 'Geographic Pricing', icon: FileText, feature: 'inventory' },
      { href: '/admin/tastings', label: 'Tastings', icon: CalendarDays, feature: 'tastings' },
      { href: '/admin/tastings/roi', label: 'Tasting ROI', icon: TrendingUp, feature: 'tastings' },
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
      { href: '/admin/finance/ledger', label: 'Payments Ledger', icon: BookOpen, feature: 'accounting' },
      { href: '/admin/invoicing/aging', label: 'AR Aging', icon: BarChart3, feature: 'invoicing' },
      { href: '/admin/finance/reconciliation', label: 'Reconciliation', icon: ClipboardList, feature: 'accounting' },
      { href: '/admin/finance/statements', label: 'Statements', icon: FileText, feature: 'accounting' },
      { href: '/admin/accounts', label: 'Chart of Accounts', icon: BookOpen, feature: 'accounting' },
    ],
  },
  {
    title: 'Sales Team',
    items: [
      { href: '/admin/sales/members', label: 'Members', icon: UserCheck, feature: 'dashboard' },
      { href: '/admin/sales/regions', label: 'Regions', icon: Globe, feature: 'dashboard' },
      { href: '/admin/sales/commissions', label: 'Commissions', icon: DollarSign, feature: 'dashboard' },
      { href: '/admin/sales/promotion-catalog', label: 'Promotion Catalog', icon: Star, feature: 'promotions' },
    ],
  },
  {
    title: 'Admin',
    items: [
      { href: '/admin/users', label: 'User Management', icon: Users, feature: 'users' },
      { href: '/admin/jobs', label: 'Background Jobs', icon: Cpu, feature: 'dashboard' },
      { href: '/admin/automations', label: 'Automations', icon: Workflow, feature: 'dashboard' },
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
  // Start all sections open; auto-collapse sections with no active item on first render
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  function toggle(title: string) {
    setCollapsed(prev => ({ ...prev, [title]: !prev[title] }))
  }

  return (
    <div className="space-y-2">
      {navSections.map(section => {
        const items = section.items.filter(item => hasFeature(item.feature as FeatureKey, roles, featureFlags))
        if (items.length === 0) return null

        const colors = SECTION_COLORS[section.title] ?? SECTION_COLORS['Admin']
        const hasActive = items.some(({ href }) => pathname === href || pathname.startsWith(href + '/'))
        const isCollapsed = collapsed[section.title] ?? false

        return (
          <div key={section.title} className="py-1">
            <button
              onClick={() => toggle(section.title)}
              className="flex items-center gap-1.5 w-full px-1 pb-1 group"
            >
              <span className={`w-1.5 h-1.5 rounded-full ${colors.dot} shrink-0`} />
              <p className={`text-[10px] font-bold uppercase tracking-[0.14em] ${colors.label} flex-1 text-left`}>
                {section.title}
              </p>
              {hasActive && !isCollapsed && (
                <span className={`w-1.5 h-1.5 rounded-full ${colors.dot} opacity-60 shrink-0`} />
              )}
              <ChevronRight className={cn(
                'w-3 h-3 shrink-0 transition-transform duration-200',
                colors.label,
                'opacity-50 group-hover:opacity-100',
                isCollapsed ? 'rotate-0' : 'rotate-90'
              )} />
            </button>
            {!isCollapsed && items.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + '/')
              const count = navCounts?.[href] ?? 0
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={onNav}
                  className={cn(
                    'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                    active
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  )}
                >
                  <Icon className={cn('w-4 h-4 flex-shrink-0', active ? 'text-blue-600' : 'text-slate-400')} />
                  {label}
                  {(count > 0 || active) && (
                    <span className="ml-auto flex items-center gap-2">
                      {count > 0 && (
                        <span
                          className={cn(
                            'inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-semibold',
                            active ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-600'
                          )}
                        >
                          {count > 99 ? '99+' : count}
                        </span>
                      )}
                      {active && <ChevronRight className="w-3 h-3 text-blue-500" />}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        )

      })}
    </div>
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
  const [dialpadOpen, setDialpadOpen] = useState(false)

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  return (
    <>
      {/* ── Desktop sidebar ─────────────────────────────────── */}
      <aside className="hidden md:flex w-64 min-h-screen bg-white border-r border-slate-200 flex-col flex-shrink-0">
        <div className="p-5 border-b border-slate-200">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Image src="/brand/logo.png" alt="AHAWC" width={40} height={40}
                className="h-10 w-10 rounded-xl bg-slate-100 p-1 object-contain" priority />
              <div>
                <p className="font-bold text-slate-900">AHAWC</p>
                <p className="text-xs text-slate-400">Admin Portal</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <DialpadButton onClick={() => setDialpadOpen(true)} />
              <NotificationBell items={notifications} unreadCount={unreadCount} />
            </div>
          </div>
        </div>

        <div className="px-3 py-2 border-b border-slate-100">
          <CommandPalette />
        </div>

        <nav className="flex-1 px-3 py-2 overflow-y-auto space-y-2">
          <NavLinks pathname={pathname} featureFlags={featureFlags} roles={roles} navCounts={navCounts} />
        </nav>

        <div className="p-4 border-t border-slate-200 space-y-3">
          {showViewSwitcher && <SuperAdminViewSwitcher />}
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </aside>

      {/* ── Mobile top bar ──────────────────────────────────── */}
      <header className="md:hidden fixed top-0 inset-x-0 z-40 flex items-center justify-between bg-white border-b border-slate-200 px-4 h-14 shadow-sm">
        <div className="flex items-center gap-2.5">
          <Image src="/brand/logo.png" alt="AHAWC" width={32} height={32}
            className="h-8 w-8 rounded-lg bg-slate-100 p-0.5 object-contain" priority />
          <div>
            <p className="font-bold text-slate-900 text-sm leading-none">AHAWC</p>
            <p className="text-xs text-slate-400 leading-none mt-0.5">Admin Portal</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <DialpadButton onClick={() => setDialpadOpen(true)} />
          <NotificationBell items={notifications} unreadCount={unreadCount} />
          <button
            onClick={() => setOpen(true)}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* ── Mobile drawer ───────────────────────────────────── */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <aside className="w-72 max-w-[85vw] bg-white flex flex-col shadow-2xl animate-in slide-in-from-left duration-200">
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <Image src="/brand/logo.png" alt="AHAWC" width={36} height={36}
                  className="h-9 w-9 rounded-xl bg-slate-100 p-0.5 object-contain" />
                <div>
                  <p className="font-bold text-slate-900 text-sm">AHAWC</p>
                  <p className="text-xs text-slate-400">Admin Portal</p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 px-3 py-2 overflow-y-auto space-y-2">
              <NavLinks pathname={pathname} featureFlags={featureFlags} roles={roles} navCounts={navCounts} onNav={() => setOpen(false)} />
            </nav>

            <div className="p-4 border-t border-slate-200 space-y-3">
              {showViewSwitcher && <SuperAdminViewSwitcher />}
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              >
                <LogOut className="w-4 h-4" /> Sign Out
              </button>
            </div>
          </aside>

          <div
            className="flex-1 bg-black/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
        </div>
      )}

      <DialpadSidebar open={dialpadOpen} onClose={() => setDialpadOpen(false)} />
    </>
  )
}
