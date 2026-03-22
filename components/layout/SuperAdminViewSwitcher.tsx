'use client'

import { usePathname, useRouter } from 'next/navigation'
import { ChevronDown, ShieldCheck } from 'lucide-react'

const VIEW_OPTIONS = [
  { id: 'admin', label: 'Admin', href: '/admin/dashboard' },
  { id: 'staff', label: 'Staff', href: '/staff/dashboard' },
  { id: 'sales', label: 'Sales Rep', href: '/sales/dashboard' },
  { id: 'customer', label: 'Customer', href: '/customer/dashboard' },
  { id: 'driver', label: 'Driver', href: '/driver/deliveries' },
  { id: 'taster', label: 'Taster', href: '/taster/tastings' },
] as const

function getCurrentView(pathname: string) {
  if (pathname.startsWith('/admin')) return 'admin'
  if (pathname.startsWith('/staff')) return 'staff'
  if (pathname.startsWith('/sales')) return 'sales'
  if (pathname.startsWith('/driver')) return 'driver'
  if (pathname.startsWith('/taster')) return 'taster'
  if (pathname.startsWith('/customer')) return 'customer'
  return 'admin'
}

export function SuperAdminViewSwitcher({ compact = false }: { compact?: boolean }) {
  const pathname = usePathname()
  const router = useRouter()
  const value = getCurrentView(pathname)
  const current = VIEW_OPTIONS.find(option => option.id === value)

  if (compact) {
    return (
      <div className="rounded-2xl border border-violet-500/30 bg-violet-950/40 p-3.5 shadow-[0_12px_30px_rgba(2,6,23,0.35)]">
        <div className="mb-3 flex items-center gap-2">
          <ShieldCheck className="h-3.5 w-3.5 text-violet-400 shrink-0" />
          <span className="text-xs font-semibold uppercase tracking-wide text-violet-300">Switch View</span>
        </div>
        <p className="text-xs text-slate-400 mb-3 leading-snug">Current: <span className="text-slate-200 font-medium">{current?.label}</span></p>
        <div className="relative">
          <select
            aria-label="Switch portal view"
            className="w-full appearance-none rounded-xl border border-violet-500/40 bg-violet-900/50 text-slate-100 px-3 py-2.5 pr-9 text-sm font-medium outline-none transition-colors hover:border-violet-400/60 focus:border-violet-400"
            value={value}
            onChange={e => {
              const nextView = VIEW_OPTIONS.find(option => option.id === e.target.value)
              if (nextView) router.push(nextView.href)
            }}
          >
            {VIEW_OPTIONS.map(option => (
              <option key={option.id} value={option.id} className="bg-slate-900">
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-violet-400" />
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xl">
      <div className="mb-2 flex items-center gap-2">
        <ShieldCheck className="h-3.5 w-3.5 text-violet-600 shrink-0" />
        <span className="text-xs font-semibold uppercase tracking-wide text-violet-600">Switch View</span>
      </div>
      <p className="text-xs text-slate-500 mb-3 leading-snug">Current: <span className="text-slate-700 font-medium">{current?.label}</span></p>
      <div className="relative">
        <select
          aria-label="Switch portal view"
          className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 text-slate-900 px-3 py-2.5 pr-9 text-sm font-medium outline-none transition-colors hover:border-violet-400 focus:border-violet-500 focus:ring-1 focus:ring-violet-200"
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
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      </div>
    </div>
  )
}
