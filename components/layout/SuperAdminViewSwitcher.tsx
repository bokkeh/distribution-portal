'use client'

import { usePathname, useRouter } from 'next/navigation'
import { ChevronDown, ShieldCheck, Building2, Eye, Loader2, Search, AlertCircle } from 'lucide-react'
import { useState, useTransition, useRef, useEffect } from 'react'
import { searchAccountsForViewAs, startViewAsAccount } from '@/actions/view-as'

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

type AccountResult = { id: string; companyName: string; userId: string | null }

function AccountViewAs({ compact }: { compact: boolean }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<AccountResult[]>([])
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleSearch(val: string) {
    setQuery(val)
    setError(null)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!val.trim()) { setResults([]); setOpen(false); return }
    setSearching(true)
    debounceRef.current = setTimeout(async () => {
      const res = await searchAccountsForViewAs(val)
      setResults(res)
      setOpen(true)
      setSearching(false)
    }, 300)
  }

  function handleViewAs(account: AccountResult) {
    setError(null)
    setOpen(false)
    startTransition(async () => {
      const result = await startViewAsAccount(account.id)
      if (result?.error) setError(result.error)
    })
  }

  const inputClass = compact
    ? 'w-full rounded-xl border border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400 px-3 py-2 pr-8 text-xs outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-100 transition'
    : 'w-full rounded-xl border border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400 px-3 py-2 pr-8 text-xs outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-100 transition'

  return (
    <div ref={containerRef} className="relative mt-3 border-t border-dashed border-slate-200 pt-3">
      <div className={`mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide ${compact ? 'text-violet-600' : 'text-violet-600'}`}>
        <Building2 className="w-3 h-3" />
        View as Account
      </div>
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={e => handleSearch(e.target.value)}
          placeholder="Search accounts…"
          className={inputClass}
        />
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
          {searching || isPending
            ? <Loader2 className={`w-3 h-3 animate-spin ${compact ? 'text-slate-400' : 'text-slate-400'}`} />
            : <Search className={`w-3 h-3 ${compact ? 'text-slate-400' : 'text-slate-400'}`} />
          }
        </div>
      </div>

      {open && results.length > 0 && (
        <div className={`absolute left-0 right-0 z-50 mt-1 overflow-hidden rounded-xl border shadow-lg ${compact ? 'border-slate-200 bg-white' : 'border-slate-200 bg-white'}`}>
          {results.map(account => (
            <button
              key={account.id}
              onClick={() => handleViewAs(account)}
              disabled={isPending}
              className={`flex items-center justify-between w-full px-3 py-2 text-xs text-left transition-colors ${
                compact
                  ? 'border-b border-slate-100 text-slate-700 hover:bg-violet-50 last:border-0'
                  : 'text-slate-700 hover:bg-violet-50 border-b border-slate-100 last:border-0'
              }`}
            >
              <span className="truncate font-medium">{account.companyName}</span>
              <Eye className={`w-3 h-3 shrink-0 ml-2 ${account.userId ? (compact ? 'text-violet-500' : 'text-violet-500') : 'text-slate-300'}`} />
            </button>
          ))}
        </div>
      )}

      {open && results.length === 0 && query.trim() && !searching && (
        <p className={`text-[11px] mt-1 ${compact ? 'text-slate-400' : 'text-slate-400'}`}>No accounts found</p>
      )}

      {error && (
        <p className="flex items-start gap-1 text-[11px] text-red-400 mt-1.5">
          <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />{error}
        </p>
      )}
    </div>
  )
}

export function SuperAdminViewSwitcher({ compact = false, embedded = false }: { compact?: boolean; embedded?: boolean }) {
  const pathname = usePathname()
  const router = useRouter()
  const value = getCurrentView(pathname)
  const current = VIEW_OPTIONS.find(option => option.id === value)

  if (compact) {
    return (
      <div className={embedded ? 'bg-white p-2' : 'rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xl'}>
        <div className="mb-3 flex items-center gap-2">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-violet-600" />
          <span className="text-xs font-semibold uppercase tracking-wide text-violet-600">Switch View</span>
        </div>
        <p className="mb-3 text-xs leading-snug text-slate-500">Current: <span className="font-medium text-slate-700">{current?.label}</span></p>
        <div className="relative">
          <select
            aria-label="Switch portal view"
            className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 pr-9 text-sm font-medium text-slate-900 outline-none transition-colors hover:border-violet-400 focus:border-violet-500 focus:ring-1 focus:ring-violet-200"
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
        <AccountViewAs compact />
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
      <AccountViewAs compact={false} />
    </div>
  )
}
