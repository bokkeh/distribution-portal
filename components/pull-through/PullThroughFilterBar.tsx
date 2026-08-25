'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useTransition } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export type FilterOptions = {
  cities: string[]
  markets: string[]
  territories: string[]
  distributors: string[]
  accountTypes: string[]
  reps: [string, string][]
  tasters: string[]
}

type SelectFilter = {
  param: string
  label: string
  options: { value: string; label: string }[]
}

/**
 * All filter values come from the CRM/account metadata already present on the
 * accounts in scope — nothing is hand-maintained here.
 */
export function PullThroughFilterBar({ options, basePath }: { options: FilterOptions; basePath: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const setParam = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(searchParams.toString())
      if (value) next.set(key, value)
      else next.delete(key)
      const query = next.toString()
      startTransition(() => router.push(`${basePath}${query ? `?${query}` : ''}`, { scroll: false }))
    },
    [basePath, router, searchParams],
  )

  const selects: SelectFilter[] = [
    { param: 'city', label: 'City', options: options.cities.map((v) => ({ value: v, label: v })) },
    { param: 'market', label: 'Market', options: options.markets.map((v) => ({ value: v, label: v })) },
    { param: 'territory', label: 'Territory', options: options.territories.map((v) => ({ value: v, label: v })) },
    {
      param: 'distributor',
      label: 'Distributor / Source',
      options: options.distributors.map((v) => ({ value: v, label: v })),
    },
    {
      param: 'rep',
      label: 'Sales Rep',
      options: [
        ...options.reps.map(([id, name]) => ({ value: id, label: name })),
        { value: 'unassigned', label: 'Unassigned' },
      ],
    },
    { param: 'taster', label: 'Taster', options: options.tasters.map((v) => ({ value: v, label: v })) },
    {
      param: 'accountType',
      label: 'Account Type',
      options: options.accountTypes.map((v) => ({ value: v, label: v.replace(/_/g, ' ') })),
    },
    {
      param: 'temperature',
      label: 'Temperature',
      options: [
        { value: 'hot', label: '🔥 Hot' },
        { value: 'warm', label: 'Warm' },
        { value: 'cold', label: 'Cold' },
        { value: 'at_risk', label: '⚠️ At risk' },
        { value: 'new', label: '🆕 New' },
      ],
    },
    {
      param: 'inventory',
      label: 'Inventory Status',
      options: [
        { value: 'confirmed', label: 'Confirmed' },
        { value: 'estimated', label: 'Estimated' },
        { value: 'unknown', label: 'Unknown' },
        { value: 'stale', label: 'Stale check' },
        { value: 'low', label: 'Low stock' },
      ],
    },
    {
      param: 'reordered',
      label: 'Reordered',
      options: [
        { value: 'yes', label: 'Has reordered' },
        { value: 'no', label: 'Never reordered' },
      ],
    },
    {
      param: 'tasted',
      label: 'Tastings',
      options: [
        { value: 'yes', label: 'Has had a tasting' },
        { value: 'no', label: 'Never had a tasting' },
      ],
    },
    {
      param: 'tastingPerformance',
      label: 'Tasting Performance',
      options: [
        { value: 'converted', label: 'Order within 30 days' },
        { value: 'not_converted', label: 'No order within 30 days' },
      ],
    },
    {
      param: 'action',
      label: 'Recommended Action',
      options: [
        { value: 'call_for_reorder', label: 'Call for reorder' },
        { value: 'follow_up_after_tasting', label: 'Follow up after tasting' },
        { value: 'book_tasting', label: 'Book tasting' },
        { value: 'inventory_check_needed', label: 'Inventory check needed' },
        { value: 'sales_visit', label: 'Sales visit' },
        { value: 'high_priority', label: 'High priority' },
        { value: 'win_back', label: 'Win back' },
        { value: 'first_reorder_push', label: 'Push for first reorder' },
        { value: 'no_action', label: 'No action' },
      ],
    },
    {
      param: 'minDays',
      label: 'Days Since Last Order',
      options: [
        { value: '14', label: '14+ days' },
        { value: '30', label: '30+ days' },
        { value: '45', label: '45+ days' },
        { value: '60', label: '60+ days' },
        { value: '90', label: '90+ days' },
      ],
    },
  ]

  const activeCount = selects.filter((select) => searchParams.get(select.param)).length + (searchParams.get('q') ? 1 : 0)

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[200px] flex-1">
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Search
          </label>
          <Input
            type="search"
            defaultValue={searchParams.get('q') ?? ''}
            placeholder="Account, city, contact, rep"
            onChange={(event) => setParam('q', event.target.value)}
            className="h-9"
          />
        </div>

        {selects
          .filter((select) => select.options.length > 0)
          .map((select) => (
            <div key={select.param} className="min-w-[150px]">
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {select.label}
              </label>
              <select
                value={searchParams.get(select.param) ?? ''}
                onChange={(event) => setParam(select.param, event.target.value)}
                className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400"
              >
                <option value="">All</option>
                {select.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          ))}

        {activeCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="h-9"
            onClick={() => startTransition(() => router.push(basePath, { scroll: false }))}
          >
            <X className="mr-1 h-3.5 w-3.5" />
            Clear {activeCount}
          </Button>
        )}
      </div>
      {isPending && <p className="mt-2 text-[11px] text-muted-foreground">Updating…</p>}
    </div>
  )
}
