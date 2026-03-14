'use client'

import { usePathname, useRouter } from 'next/navigation'
import { ChevronDown, Layers, Sparkles } from 'lucide-react'

const VIEW_OPTIONS = [
  { id: 'admin', label: 'Admin', href: '/admin/dashboard' },
  { id: 'staff', label: 'Staff', href: '/staff/dashboard' },
  { id: 'customer', label: 'Customer', href: '/customer/dashboard' },
  { id: 'driver', label: 'Driver', href: '/driver/deliveries' },
  { id: 'taster', label: 'Taster', href: '/taster/tastings' },
] as const

function getCurrentView(pathname: string) {
  if (pathname.startsWith('/admin')) return 'admin'
  if (pathname.startsWith('/staff')) return 'staff'
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

  return (
    <div className={compact ? 'rounded-2xl border border-slate-600/80 bg-[linear-gradient(180deg,rgba(30,41,59,0.95),rgba(15,23,42,0.95))] p-3.5 shadow-[0_12px_30px_rgba(2,6,23,0.35)]' : 'rounded-2xl border border-slate-200 bg-white/95 p-3.5 shadow-lg backdrop-blur'}>
      <div className={`mb-3 flex items-center justify-between gap-3 ${compact ? 'text-slate-100' : 'text-slate-900'}`}>
        <div className="flex items-center gap-2">
          <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${compact ? 'bg-emerald-400/15 text-emerald-300' : 'bg-emerald-50 text-emerald-700'}`}>
            <Layers className="h-4 w-4" />
          </div>
          <div>
            <span className="block text-sm font-semibold">Switch View</span>
            <span className={`block text-xs ${compact ? 'text-slate-400' : 'text-slate-500'}`}>Current: {current?.label}</span>
          </div>
        </div>
        <Sparkles className={`h-4 w-4 ${compact ? 'text-emerald-300' : 'text-emerald-600'}`} />
      </div>

      <div className="relative">
        <select
          aria-label="Switch portal view"
          className={`w-full appearance-none rounded-xl border px-3 py-3 pr-10 text-sm font-medium outline-none transition-colors ${
            compact
              ? 'border-slate-500 bg-slate-950/70 text-slate-100 hover:border-emerald-300/50'
              : 'border-slate-300 bg-white text-slate-900 hover:border-emerald-400'
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
        <ChevronDown className={`pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 ${compact ? 'text-slate-400' : 'text-slate-500'}`} />
      </div>
    </div>
  )
}
