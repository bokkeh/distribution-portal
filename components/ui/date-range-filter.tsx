'use client'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { CalendarDays } from 'lucide-react'

const PRESETS = [
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
  { label: '6 months', days: 180 },
  { label: '1 year', days: 365 },
  { label: 'All time', days: 0 },
] as const

interface DateRangeFilterProps {
  /** URL param name for start date (default: 'from') */
  fromParam?: string
  /** URL param name for end date (default: 'to') */
  toParam?: string
}

export function DateRangeFilter({ fromParam = 'from', toParam = 'to' }: DateRangeFilterProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const currentFrom = searchParams.get(fromParam) ?? ''
  const currentTo = searchParams.get(toParam) ?? ''

  const applyPreset = useCallback((days: number) => {
    const params = new URLSearchParams(searchParams.toString())
    if (days === 0) {
      params.delete(fromParam)
      params.delete(toParam)
    } else {
      const to = new Date()
      const from = new Date()
      from.setDate(from.getDate() - days)
      params.set(fromParam, from.toISOString().slice(0, 10))
      params.set(toParam, to.toISOString().slice(0, 10))
    }
    router.push(`${pathname}?${params.toString()}`)
  }, [router, pathname, searchParams, fromParam, toParam])

  const applyCustom = useCallback((from: string, to: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (from) params.set(fromParam, from)
    else params.delete(fromParam)
    if (to) params.set(toParam, to)
    else params.delete(toParam)
    router.push(`${pathname}?${params.toString()}`)
  }, [router, pathname, searchParams, fromParam, toParam])

  return (
    <div className="flex flex-wrap items-center gap-2">
      <CalendarDays className="h-4 w-4 text-slate-400 shrink-0" />

      {/* Preset buttons */}
      <div className="flex items-center gap-1">
        {PRESETS.map(({ label, days }) => {
          const isActive = days === 0
            ? !currentFrom && !currentTo
            : currentFrom === (() => { const d = new Date(); d.setDate(d.getDate() - days); return d.toISOString().slice(0, 10) })()
          return (
            <button
              key={label}
              onClick={() => applyPreset(days)}
              className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-colors ${
                isActive
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* Custom date inputs */}
      <div className="flex items-center gap-1.5 ml-1">
        <input
          type="date"
          value={currentFrom}
          onChange={e => applyCustom(e.target.value, currentTo)}
          className="h-7 rounded-lg border border-slate-200 px-2 text-xs text-slate-600 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
        <span className="text-xs text-slate-400">to</span>
        <input
          type="date"
          value={currentTo}
          onChange={e => applyCustom(currentFrom, e.target.value)}
          className="h-7 rounded-lg border border-slate-200 px-2 text-xs text-slate-600 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
      </div>

      {(currentFrom || currentTo) && (
        <Button variant="ghost" size="sm" className="h-7 text-xs text-slate-400 hover:text-slate-600" onClick={() => applyPreset(0)}>
          Clear
        </Button>
      )}
    </div>
  )
}
