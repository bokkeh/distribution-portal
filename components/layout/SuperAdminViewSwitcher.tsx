'use client'

import { usePathname, useRouter } from 'next/navigation'
import { Layers } from 'lucide-react'

const VIEW_OPTIONS = [
  { id: 'admin', label: 'Admin', href: '/admin/dashboard' },
  { id: 'staff', label: 'Staff', href: '/staff/dashboard' },
  { id: 'customer', label: 'Customer', href: '/customer/dashboard' },
  { id: 'driver', label: 'Driver', href: '/driver/deliveries' },
  { id: 'taster', label: 'Taster', href: '/customer/products' },
] as const

function getCurrentView(pathname: string) {
  if (pathname.startsWith('/admin')) return 'admin'
  if (pathname.startsWith('/staff')) return 'staff'
  if (pathname.startsWith('/driver')) return 'driver'
  if (pathname.startsWith('/customer/products')) return 'taster'
  if (pathname.startsWith('/customer')) return 'customer'
  return 'admin'
}

export function SuperAdminViewSwitcher({ compact = false }: { compact?: boolean }) {
  const pathname = usePathname()
  const router = useRouter()
  const value = getCurrentView(pathname)

  return (
    <div className={compact ? 'rounded-xl border border-slate-700 bg-slate-800/80 p-3' : 'rounded-xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur'}>
      <div className={`mb-2 flex items-center gap-2 ${compact ? 'text-slate-200' : 'text-slate-900'}`}>
        <Layers className="h-4 w-4" />
        <span className="text-sm font-semibold">Switch View</span>
      </div>

      <select
        aria-label="Switch portal view"
        className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${
          compact
            ? 'border-slate-600 bg-slate-900 text-slate-100'
            : 'border-slate-300 bg-white text-slate-900'
        }`}
        value={value}
        onChange={e => {
          const nextView = VIEW_OPTIONS.find(option => option.id === e.target.value)
          if (nextView) router.push(nextView.href)
        }}
      >
        {VIEW_OPTIONS.map(option => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}
