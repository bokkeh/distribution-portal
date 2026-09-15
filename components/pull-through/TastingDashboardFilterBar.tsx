'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useTransition } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'

type SelectFilter = { param: string; label: string; options: { value: string; label: string }[] }

/** Filters for the tasting dashboard. Date range is handled by the shared DateRangeFilter. */
export function TastingDashboardFilterBar({
  options,
  basePath,
}: {
  options: { tasters: string[]; markets: string[]; distributors: string[] }
  basePath: string
}) {
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
    { param: 'taster', label: 'Taster', options: options.tasters.map((v) => ({ value: v, label: v })) },
    {
      param: 'objective',
      label: 'Objective',
      options: [
        { value: 'sell_through', label: 'Sell-through' },
        { value: 'reorder', label: 'Reorder' },
        { value: 'account_opening', label: 'Account-opening' },
        { value: 'strategic', label: 'Strategic' },
        { value: 'unset', label: 'No objective set' },
      ],
    },
    { param: 'market', label: 'Market', options: options.markets.map((v) => ({ value: v, label: v })) },
    { param: 'distributor', label: 'Distributor / Source', options: options.distributors.map((v) => ({ value: v, label: v })) },
  ]

  const activeCount = selects.filter((select) => searchParams.get(select.param)).length

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-end gap-3">
        {selects
          .filter((select) => select.options.length > 0)
          .map((select) => (
            <div key={select.param} className="min-w-[160px]">
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">{select.label}</label>
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
            onClick={() => {
              const next = new URLSearchParams(searchParams.toString())
              for (const select of selects) next.delete(select.param)
              const query = next.toString()
              startTransition(() => router.push(`${basePath}${query ? `?${query}` : ''}`, { scroll: false }))
            }}
          >
            <X className="mr-1 h-3.5 w-3.5" />
            Clear {activeCount}
          </Button>
        )}
        {isPending && <span className="text-xs text-muted-foreground">Updating…</span>}
      </div>
    </div>
  )
}
