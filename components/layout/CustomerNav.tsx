'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Package, ShoppingCart, FileText, User, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { signOut } from 'next-auth/react'

const navItems = [
  { href: '/customer/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/customer/products', label: 'Order Products', icon: Package },
  { href: '/customer/orders', label: 'My Orders', icon: ShoppingCart },
  { href: '/customer/invoices', label: 'Invoices', icon: FileText },
  { href: '/customer/profile', label: 'Profile', icon: User },
]

export default function CustomerNav() {
  const pathname = usePathname()

  return (
    <header className="bg-white border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/customer/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold">A</span>
            </div>
            <span className="font-bold text-slate-900">AHAWC</span>
          </Link>

          {/* Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + '/')
              return (
                <Link key={href} href={href}
                  className={cn('flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                    active ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  )}>
                  <Icon className="w-4 h-4" />{label}
                </Link>
              )
            })}
          </nav>

          <button onClick={() => signOut({ callbackUrl: '/login' })}
            className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 transition-colors">
            <LogOut className="w-4 h-4" />Sign Out
          </button>
        </div>

        {/* Mobile nav */}
        <div className="md:hidden flex items-center gap-1 pb-3 overflow-x-auto">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link key={href} href={href}
                className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors',
                  active ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'
                )}>
                <Icon className="w-3.5 h-3.5" />{label}
              </Link>
            )
          })}
        </div>
      </div>
    </header>
  )
}
