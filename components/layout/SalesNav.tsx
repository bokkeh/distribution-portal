'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Building2, Map, User, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { signOut } from 'next-auth/react'

const navItems = [
  { href: '/sales/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/sales/accounts', label: 'My Accounts', icon: Building2 },
  { href: '/sales/routes', label: 'Routes', icon: Map },
  { href: '/sales/profile', label: 'Profile', icon: User },
]

export default function SalesNav({ userName }: { userName?: string }) {
  const pathname = usePathname()

  return (
    <header className="border-b bg-white/95 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex min-h-16 items-center justify-between gap-4 py-3">
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

          <div className="flex items-center gap-2">
            {userName && <span className="hidden sm:block text-sm text-slate-600">{userName}</span>}
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        <div className="flex items-center gap-1 overflow-x-auto pb-3 md:hidden">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors',
                  active ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </Link>
            )
          })}
        </div>
      </div>
    </header>
  )
}
