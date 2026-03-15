'use client'

import { Search } from 'lucide-react'

export function PortalSearch() {
  return (
    <form action="/search" className="relative w-full max-w-xl">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        type="search"
        name="q"
        placeholder="Search accounts, orders, users, deliveries, tastings, inbox threads..."
        className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-900 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-blue-300"
      />
    </form>
  )
}
