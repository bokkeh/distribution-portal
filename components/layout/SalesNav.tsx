'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Building2, Map, User, LogOut, DollarSign, Wine, TrendingUp, Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { signOut } from 'next-auth/react'
import { useState, useEffect } from 'react'
import { DialpadButton, DialpadSidebar } from '@/components/admin/DialpadSidebar'
import { NotificationBell } from '@/components/notifications/NotificationBell'

const navItems = [
  { href: '/sales/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/sales/accounts', label: 'My Accounts', icon: Building2 },
  { href: '/sales/routes', label: 'Routes', icon: Map },
  { href: '/sales/tastings', label: 'Tastings', icon: Wine },
  { href: '/sales/forecast', label: 'Forecast', icon: TrendingUp },
  { href: '/sales/commissions', label: 'Commissions', icon: DollarSign },
  { href: '/sales/profile', label: 'Profile', icon: User },
]

type NotificationItem = {
  id: string; kind: string; title: string; body: string
  href: string | null; readAt: string | Date | null; createdAt: string | Date
}

export default function SalesNav({ userName, notifications = [], unreadCount = 0 }: {
  userName?: string
  notifications?: NotificationItem[]
  unreadCount?: number
}) {
  const pathname = usePathname()
  const [dialpadOpen, setDialpadOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => { setMenuOpen(false) }, [pathname])
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [menuOpen])

  return (
    <>
      <header className="border-b bg-white/95 backdrop-blur sticky top-0 z-30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-4">
            <Link href="/sales/dashboard" className="flex items-center gap-3">
              <Image
                src="/brand/logo.png"
                alt="AHAWC"
                width={36}
                height={36}
                className="h-9 w-9 rounded-xl bg-slate-100 p-1 object-contain"
                priority
              />
              <div>
                <span className="block font-bold text-slate-900">AHAWC</span>
                <span className="block text-xs text-slate-500">Sales Portal</span>
              </div>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map(({ href, label, icon: Icon }) => {
                const active = pathname === href || pathname.startsWith(href + '/')
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      'flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                      active ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </Link>
                )
              })}
            </nav>

            {/* Right actions */}
            <div className="flex items-center gap-1">
              <DialpadButton onClick={() => setDialpadOpen(true)} />
              <NotificationBell items={notifications} unreadCount={unreadCount} />
              {userName && <span className="hidden sm:block text-sm text-slate-600 px-1">{userName}</span>}
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="hidden md:flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
              {/* Hamburger — mobile only */}
              <button
                onClick={() => setMenuOpen(true)}
                className="md:hidden p-2 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                aria-label="Open menu"
              >
                <Menu className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <aside className="w-72 max-w-[85vw] bg-white flex flex-col shadow-2xl animate-in slide-in-from-left duration-200">
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <Image src="/brand/logo.png" alt="AHAWC" width={36} height={36}
                  className="h-9 w-9 rounded-xl bg-slate-100 p-0.5 object-contain" />
                <div>
                  <p className="font-bold text-slate-900 text-sm">AHAWC</p>
                  <p className="text-xs text-slate-400">Sales Portal</p>
                </div>
              </div>
              <button
                onClick={() => setMenuOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {userName && (
              <div className="px-5 py-3 border-b border-slate-100 text-sm text-slate-600 font-medium">
                {userName}
              </div>
            )}

            <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
              {navItems.map(({ href, label, icon: Icon }) => {
                const active = pathname === href || pathname.startsWith(href + '/')
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                      active ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    )}
                  >
                    <Icon className={cn('w-4 h-4 shrink-0', active ? 'text-blue-600' : 'text-slate-400')} />
                    {label}
                  </Link>
                )
              })}
            </nav>

            <div className="p-4 border-t border-slate-200">
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              >
                <LogOut className="w-4 h-4" /> Sign Out
              </button>
            </div>
          </aside>

          <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={() => setMenuOpen(false)} />
        </div>
      )}

      <DialpadSidebar open={dialpadOpen} onClose={() => setDialpadOpen(false)} />
    </>
  )
}
