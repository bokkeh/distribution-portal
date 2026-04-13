'use client'
import { useEffect, useState, useCallback, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Command } from 'cmdk'
import {
  LayoutDashboard, ShoppingCart, FileText, Building2, Package,
  Truck, Users, CalendarDays, MessageSquare, BookOpen, Receipt,
  DollarSign, HeartPulse, Workflow, UserCircle, Search, ArrowRight,
  Star, Cpu, Activity, TrendingUp, Globe, UserCheck, BarChart3,
  ClipboardList,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type SearchResult = {
  id: string
  label: string
  sublabel?: string
  href: string
  type: 'order' | 'account' | 'invoice' | 'tasting' | 'delivery' | 'user'
}

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard, section: 'Navigation' },
  { label: 'Needs Attention', href: '/admin/attention', icon: Activity, section: 'Navigation' },
  { label: 'Orders', href: '/admin/orders', icon: ShoppingCart, section: 'Navigation' },
  { label: 'Deliveries', href: '/admin/deliveries', icon: Truck, section: 'Navigation' },
  { label: 'Driver Performance', href: '/admin/deliveries/performance', icon: TrendingUp, section: 'Navigation' },
  { label: 'Invoicing', href: '/admin/invoicing', icon: Receipt, section: 'Navigation' },
  { label: 'AR Aging', href: '/admin/invoicing/aging', icon: BarChart3, section: 'Navigation' },
  { label: 'Wholesaler Requests', href: '/admin/wholesale-requests', icon: Star, section: 'Navigation' },
  { label: 'Inventory', href: '/admin/inventory', icon: Package, section: 'Navigation' },
  { label: 'Background Jobs', href: '/admin/jobs', icon: Cpu, section: 'Navigation' },
  { label: 'Tastings', href: '/admin/tastings', icon: CalendarDays, section: 'Navigation' },
  { label: 'Tasting ROI', href: '/admin/tastings/roi', icon: TrendingUp, section: 'Navigation' },
  { label: 'CRM / Accounts', href: '/admin/crm', icon: Building2, section: 'Navigation' },
  { label: 'SMS Inbox', href: '/admin/inbox', icon: MessageSquare, section: 'Navigation' },
  { label: 'Payments Ledger', href: '/admin/finance/ledger', icon: BookOpen, section: 'Navigation' },
  { label: 'Reconciliation', href: '/admin/finance/reconciliation', icon: ClipboardList, section: 'Navigation' },
  { label: 'Statements', href: '/admin/finance/statements', icon: FileText, section: 'Navigation' },
  { label: 'Chart of Accounts', href: '/admin/accounts', icon: BookOpen, section: 'Navigation' },
  { label: 'Sales Members', href: '/admin/sales/members', icon: UserCheck, section: 'Navigation' },
  { label: 'Sales Regions', href: '/admin/sales/regions', icon: Globe, section: 'Navigation' },
  { label: 'Commissions', href: '/admin/sales/commissions', icon: DollarSign, section: 'Navigation' },
  { label: 'Promotion Catalog', href: '/admin/sales/promotion-catalog', icon: Star, section: 'Navigation' },
  { label: 'User Management', href: '/admin/users', icon: Users, section: 'Navigation' },
  { label: 'Automations', href: '/admin/automations', icon: Workflow, section: 'Navigation' },
  { label: 'System Health', href: '/admin/system', icon: HeartPulse, section: 'Navigation' },
  { label: 'My Profile', href: '/admin/profile', icon: UserCircle, section: 'Navigation' },
]

const typeIcon: Record<SearchResult['type'], React.ElementType> = {
  order: ShoppingCart,
  account: Building2,
  invoice: Receipt,
  tasting: CalendarDays,
  delivery: Truck,
  user: Users,
}

const typeHref: Record<SearchResult['type'], (id: string) => string> = {
  order: (id) => `/admin/orders/${id}`,
  account: (id) => `/admin/crm/${id}`,
  invoice: (id) => `/admin/invoicing/${id}`,
  tasting: (id) => `/admin/tastings/${id}`,
  delivery: (id) => `/admin/deliveries/${id}`,
  user: (id) => `/admin/users/${id}`,
}

export function CommandPalette() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isPending, startTransition] = useTransition()

  // Toggle on ⌘K / Ctrl+K
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(prev => !prev)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setResults([]); return }
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
      if (res.ok) setResults(await res.json())
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => startTransition(() => { search(query) }), 200)
    return () => clearTimeout(t)
  }, [query, search])

  function navigate(href: string) {
    setOpen(false)
    setQuery('')
    setResults([])
    router.push(href)
  }

  const filteredNav = query.length < 1
    ? NAV_ITEMS
    : NAV_ITEMS.filter(item => item.label.toLowerCase().includes(query.toLowerCase()))

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="hidden md:flex items-center gap-2 px-3 py-1.5 text-sm text-slate-400 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors border border-slate-200"
        title="Search (⌘K)"
      >
        <Search className="w-3.5 h-3.5" />
        <span>Search…</span>
        <kbd className="ml-1 text-[10px] bg-white border border-slate-200 rounded px-1 py-0.5 font-mono text-slate-400">⌘K</kbd>
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <Command shouldFilter={false} className="flex flex-col">
              <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
                <Search className="w-4 h-4 text-slate-400 shrink-0" />
                <Command.Input
                  autoFocus
                  placeholder="Search orders, accounts, tastings…"
                  value={query}
                  onValueChange={setQuery}
                  className="flex-1 text-sm bg-transparent outline-none placeholder:text-slate-400"
                />
                {isPending && <span className="text-xs text-slate-400">searching…</span>}
                <kbd className="text-[10px] bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5 font-mono text-slate-400">ESC</kbd>
              </div>

              <Command.List className="max-h-[420px] overflow-y-auto p-2">
                {results.length > 0 && (
                  <Command.Group heading={<span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-2">Results</span>}>
                    {results.map(result => {
                      const Icon = typeIcon[result.type]
                      return (
                        <Command.Item
                          key={result.id}
                          value={result.id}
                          onSelect={() => navigate(typeHref[result.type](result.id))}
                          className={cn(
                            'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm cursor-pointer',
                            'aria-selected:bg-slate-100 hover:bg-slate-50 transition-colors'
                          )}
                        >
                          <Icon className="w-4 h-4 text-slate-400 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-slate-900 truncate">{result.label}</p>
                            {result.sublabel && <p className="text-xs text-slate-400 truncate">{result.sublabel}</p>}
                          </div>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                        </Command.Item>
                      )
                    })}
                  </Command.Group>
                )}

                {filteredNav.length > 0 && (
                  <Command.Group heading={<span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-2">Navigation</span>}>
                    {filteredNav.map(item => {
                      const Icon = item.icon
                      return (
                        <Command.Item
                          key={item.href}
                          value={item.href}
                          onSelect={() => navigate(item.href)}
                          className={cn(
                            'flex items-center gap-3 px-3 py-2 rounded-xl text-sm cursor-pointer',
                            'aria-selected:bg-slate-100 hover:bg-slate-50 transition-colors'
                          )}
                        >
                          <Icon className="w-4 h-4 text-slate-400 shrink-0" />
                          <span className="flex-1 text-slate-700">{item.label}</span>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                        </Command.Item>
                      )
                    })}
                  </Command.Group>
                )}

                {query.length >= 2 && results.length === 0 && !isPending && (
                  <Command.Empty className="py-8 text-center text-sm text-slate-400">
                    No results for &ldquo;{query}&rdquo;
                  </Command.Empty>
                )}
              </Command.List>
            </Command>
          </div>
        </div>
      )}
    </>
  )
}
