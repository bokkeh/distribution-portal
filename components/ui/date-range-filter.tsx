'use client'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CalendarDays } from 'lucide-react'

const PRESETS = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last7', label: 'Last 7 days' },
  { value: 'last14', label: 'Last 14 days' },
  { value: 'thisMonth', label: 'This month' },
  { value: 'lastMonth', label: 'Last month' },
  { value: 'all', label: 'All time' },
] as const

type PresetValue = (typeof PRESETS)[number]['value'] | 'custom'

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

  function formatDateInput(date: Date) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  function startOfMonth(date: Date) {
    return new Date(date.getFullYear(), date.getMonth(), 1)
  }

  function endOfMonth(date: Date) {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0)
  }

  function addDays(date: Date, days: number) {
    const next = new Date(date)
    next.setDate(next.getDate() + days)
    return next
  }

  function buildRange(preset: Exclude<PresetValue, 'custom'>) {
    const today = new Date()

    switch (preset) {
      case 'today': {
        const value = formatDateInput(today)
        return { from: value, to: value }
      }
      case 'yesterday': {
        const yesterday = addDays(today, -1)
        const value = formatDateInput(yesterday)
        return { from: value, to: value }
      }
      case 'last7':
        return { from: formatDateInput(addDays(today, -6)), to: formatDateInput(today) }
      case 'last14':
        return { from: formatDateInput(addDays(today, -13)), to: formatDateInput(today) }
      case 'thisMonth':
        return { from: formatDateInput(startOfMonth(today)), to: formatDateInput(today) }
      case 'lastMonth': {
        const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1)
        return {
          from: formatDateInput(startOfMonth(lastMonth)),
          to: formatDateInput(endOfMonth(lastMonth)),
        }
      }
      case 'all':
        return { from: '', to: '' }
    }
  }

  function navigateWithDates(from: string, to: string) {
    const params = new URLSearchParams(searchParams.toString())

    if (from) params.set(fromParam, from)
    else params.delete(fromParam)
    if (to) params.set(toParam, to)
    else params.delete(toParam)

    const query = params.toString()
    router.push(query ? `${pathname}?${query}` : pathname)
  }

  function applyPreset(preset: Exclude<PresetValue, 'custom'>) {
    const nextRange = buildRange(preset)
    navigateWithDates(nextRange.from, nextRange.to)
  }

  function getCurrentPreset(): PresetValue {
    if (!currentFrom && !currentTo) return 'all'

    for (const preset of PRESETS) {
      if (preset.value === 'all') continue
      const range = buildRange(preset.value)
      if (range.from === currentFrom && range.to === currentTo) {
        return preset.value
      }
    }

    return 'custom'
  }

  const currentPreset = getCurrentPreset()

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white/90 p-3 shadow-sm">
      <CalendarDays className="h-4 w-4 text-slate-400 shrink-0" />

      <Select
        value={currentPreset}
        onValueChange={(value) => {
          if (value === 'custom') return
          applyPreset(value as Exclude<PresetValue, 'custom'>)
        }}
      >
        <SelectTrigger className="h-9 w-[170px] bg-white text-sm">
          <SelectValue placeholder="Select range" />
        </SelectTrigger>
        <SelectContent>
          {PRESETS.map((preset) => (
            <SelectItem key={preset.value} value={preset.value}>
              {preset.label}
            </SelectItem>
          ))}
          <SelectItem value="custom">Custom range</SelectItem>
        </SelectContent>
      </Select>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="date"
          value={currentFrom}
          onChange={(event) => navigateWithDates(event.target.value, currentTo)}
          className="h-9 w-[150px] bg-white text-sm"
        />
        <span className="text-xs text-slate-400">to</span>
        <Input
          type="date"
          value={currentTo}
          onChange={(event) => navigateWithDates(currentFrom, event.target.value)}
          className="h-9 w-[150px] bg-white text-sm"
        />
      </div>

      {(currentFrom || currentTo) && (
        <Button variant="ghost" size="sm" className="h-9 text-xs text-slate-500 hover:text-slate-700" onClick={() => applyPreset('all')}>
          Clear
        </Button>
      )}
    </div>
  )
}
