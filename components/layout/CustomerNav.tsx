'use client'

import { useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Package, ShoppingCart, FileText, Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCart } from '@/hooks/useCart'
import type { FeatureKey } from '@/lib/users/features'
import { hasFeature } from '@/lib/users/features'
import { NotificationBell } from '@/components/notifications/NotificationBell'
import { PortalProfileMenu } from '@/components/layout/PortalProfileMenu'

const navItems = [
  { href: '/customer/dashboard', label: 'Dashboard', icon: LayoutDashboard, feature: 'dashboard' },
  { href: '/customer/products', label: 'Products', icon: Package, feature: 'products' },
  { href: '/customer/promotion-catalog', label: 'Promotion Catalog', icon: Star, feature: 'promotions' },
  { href: '/customer/orders', label: 'My Orders', icon: ShoppingCart, feature: 'orders' },
  { href: '/customer/invoices', label: 'Invoices', icon: FileText, feature: 'invoices' },
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

export default function CustomerNav({
  cartScopeKey,
  featureFlags = [],
  roles = [],
  notifications = [],
  unreadCount = 0,
  userName,
  userAvatarUrl,
  canSwitchViews = false,
}: {
  cartScopeKey: string
  featureFlags?: string[]
  roles?: string[]
  notifications?: Array<{ id: string; kind: string; title: string; body: string; href: string | null; readAt: string | Date | null; createdAt: string | Date }>
  unreadCount?: number
  userName?: string | null
  userAvatarUrl?: string | null
  canSwitchViews?: boolean
}) {
  const pathname = usePathname()
  const { itemCount, setCartScope } = useCart()

  useEffect(() => {
    setCartScope(cartScopeKey)
  }, [cartScopeKey, setCartScope])

  const cartCount = itemCount()
  const visibleNavItems = navItems.filter(item => hasFeature(item.feature as FeatureKey, roles, featureFlags))
  const canUseCart = hasFeature('cart', roles, featureFlags)

  return (
    <header className="sticky top-0 z-30 border-b bg-white/95 backdrop-blur">
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
            {visibleNavItems.map(({ href, label, icon: Icon }) => {
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
            <NotificationBell items={notifications} unreadCount={unreadCount} />
            {canUseCart ? <CartButton count={cartCount} /> : null}
            <PortalProfileMenu
              userName={userName}
              userAvatarUrl={userAvatarUrl}
              profileHref={canSwitchViews ? '/admin/profile' : '/customer/profile'}
              canSwitchViews={canSwitchViews}
            />
          </div>
        </div>

        <div className="flex items-center gap-1 overflow-x-auto pb-3 md:hidden">
          {visibleNavItems.map(({ href, label, icon: Icon }) => {
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
