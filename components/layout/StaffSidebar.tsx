'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, ShoppingCart, Building2, Package, LogOut, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { signOut } from 'next-auth/react'
import { SuperAdminViewSwitcher } from './SuperAdminViewSwitcher'

const navItems = [
  { href: '/staff/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/staff/orders', label: 'Orders', icon: ShoppingCart },
  { href: '/staff/crm', label: 'Accounts', icon: Building2 },
  { href: '/staff/inventory', label: 'Inventory', icon: Package },
]

export default function StaffSidebar({ showViewSwitcher = false }: { showViewSwitcher?: boolean }) {
  const pathname = usePathname()

  return (
    <aside className="w-64 min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      <div className="p-6 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <Image
            src="/brand/logo.png"
            alt="AHAWC logo"
            width={40}
            height={40}
            className="h-10 w-10 rounded-lg bg-white p-1 object-contain"
            priority
          />
          <div>
            <p className="font-bold text-white">AHAWC</p>
            <p className="text-xs text-slate-400">Sales Portal</p>
          </div>
        </div>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link key={href} href={href}
              className={cn('flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                active ? 'bg-green-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              )}>
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
              {active && <ChevronRight className="w-3.5 h-3.5 ml-auto" />}
            </Link>
          )
        })}
      </nav>
      <div className="p-4 border-t border-slate-700">
        {showViewSwitcher ? (
          <div className="mb-4">
            <SuperAdminViewSwitcher compact />
          </div>
        ) : null}
        <button onClick={() => signOut({ callbackUrl: '/login' })}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-slate-400 hover:bg-slate-800 hover:text-white transition-colors">
          <LogOut className="w-4 h-4" />Sign Out
        </button>
      </div>
    </aside>
  )
}
