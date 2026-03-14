'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Package, ShoppingCart, FileText, User, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { signOut } from 'next-auth/react'
import { useCart } from '@/hooks/useCart'

const navItems = [
  { href: '/customer/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/customer/products', label: 'Order Products', icon: Package },
  { href: '/customer/orders', label: 'My Orders', icon: ShoppingCart },
  { href: '/customer/invoices', label: 'Invoices', icon: FileText },
  { href: '/customer/profile', label: 'Profile', icon: User },
]

function CartButton({ count }: { count: number }) {
  return (
    <Link
      href="/customer/cart"
      className="relative flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
    >
      <ShoppingCart className="w-4 h-4" />
      <span className="hidden sm:inline">Cart</span>
      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1.5 text-xs font-semibold text-white">
        {count}
      </span>
    </Link>
  )
}

export default function CustomerNav() {
  const pathname = usePathname()
  const { itemCount } = useCart()
  const cartCount = itemCount()

  return (
    <header className="border-b bg-white/95 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex min-h-16 items-center justify-between gap-4 py-3">
          <Link href="/customer/dashboard" className="flex items-center gap-3">
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
              <span className="block text-xs text-slate-500">Customer Portal</span>
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
            <CartButton count={cartCount} />
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>

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
