'use client'

import { useMemo, useState, useTransition } from 'react'
import { addMonths, eachDayOfInterval, endOfMonth, format, getDay, startOfMonth } from 'date-fns'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { saveMyAvailability } from '@/actions/taster-availability'

function isTastingDay(date: Date) {
  const day = getDay(date)
  return day === 5 || day === 6 || day === 0
}

export function TasterAvailabilityEditor({
  submittedDates,
}: {
  submittedDates: string[]
}) {
  const [monthOffset, setMonthOffset] = useState(0)
  const [selectedByMonth, setSelectedByMonth] = useState<Record<string, Set<string>>>(() => {
    const grouped: Record<string, Set<string>> = {}
    for (const date of submittedDates) {
      const key = date.slice(0, 7)
      grouped[key] ??= new Set<string>()
      grouped[key].add(date)
    }
    return grouped
  })
  const [isPending, startTransition] = useTransition()

  const monthStart = useMemo(() => startOfMonth(addMonths(new Date(), monthOffset)), [monthOffset])
  const monthKey = format(monthStart, 'yyyy-MM')
  const monthEnd = endOfMonth(monthStart)
  const tastingDays = useMemo(
    () => eachDayOfInterval({ start: monthStart, end: monthEnd }).filter(isTastingDay),
    [monthEnd, monthStart],
  )
  const selectedDates = selectedByMonth[monthKey] ?? new Set<string>()

  function toggleDate(date: string) {
    setSelectedByMonth((prev) => {
      const next = { ...prev }
      const monthSet = new Set(next[monthKey] ?? [])
      if (monthSet.has(date)) monthSet.delete(date)
      else monthSet.add(date)
      next[monthKey] = monthSet
      return next
    })
  }

  function saveMonth() {
    startTransition(async () => {
      try {
        await saveMyAvailability({
          monthStart: format(monthStart, 'yyyy-MM-dd'),
          monthEnd: format(monthEnd, 'yyyy-MM-dd'),
          dates: Array.from(selectedDates),
        })
        toast.success('Availability saved')
      } catch (error) {
        toast.error('Unable to save availability', { description: error instanceof Error ? error.message : undefined })
      }
    })
  }

  return (
    <Card>
      <CardHeader className="space-y-4">
        <div>
          <CardTitle>My Availability</CardTitle>
          <p className="mt-1 text-sm text-slate-500">Mark the tasting days you are available for the upcoming months. Staff will use this when scheduling.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 3 }, (_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => setMonthOffset(index)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                monthOffset === index
                  ? 'bg-slate-900 text-white'
                  : 'border border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-white'
              }`}
            >
              {format(addMonths(new Date(), index), 'MMMM yyyy')}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          {tastingDays.map((day) => {
            const dateKey = format(day, 'yyyy-MM-dd')
            const selected = selectedDates.has(dateKey)

            return (
              <button
                key={dateKey}
                type="button"
                onClick={() => toggleDate(dateKey)}
                className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors ${
                  selected
                    ? 'border-emerald-300 bg-emerald-50'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div>
                  <p className="font-medium text-slate-900">{format(day, 'EEEE, MMM d')}</p>
                  <p className="text-xs text-slate-500">Tasting day</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${selected ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  {selected ? 'Available' : 'Not selected'}
                </span>
              </button>
            )
          })}
        </div>

        <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-sm text-slate-600">{selectedDates.size} day{selectedDates.size === 1 ? '' : 's'} selected for {format(monthStart, 'MMMM yyyy')}.</p>
          <Button type="button" onClick={saveMonth} disabled={isPending}>
            {isPending ? 'Saving...' : 'Save Availability'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
