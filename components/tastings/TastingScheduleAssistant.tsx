'use client'

import { useState, useTransition } from 'react'
import { getTastingScheduleSuggestions, type TastingSuggestion } from '@/actions/tastings'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sparkles, Loader2, Calendar, Users, AlertCircle, ChevronRight } from 'lucide-react'

interface Props {
  accountId: string
  accountName: string
  onSelectSlot?: (date: string, tasterId: string) => void
}

export function TastingScheduleAssistant({ accountId, accountName, onSelectSlot }: Props) {
  const [suggestions, setSuggestions] = useState<TastingSuggestion[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [expanded, setExpanded] = useState(false)

  function handleGenerate() {
    setError(null)
    setExpanded(true)
    startTransition(async () => {
      const result = await getTastingScheduleSuggestions(accountId)
      if (result.error) {
        setError(result.error)
      } else {
        setSuggestions(result.suggestions)
      }
    })
  }

  if (!expanded) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleGenerate}
        className="gap-1.5 text-violet-700 border-violet-200 hover:bg-violet-50"
      >
        <Sparkles className="w-3.5 h-3.5" />
        Suggest Dates
      </Button>
    )
  }

  return (
    <div className="rounded-xl border border-violet-100 bg-violet-50/50 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-violet-600" />
          <span className="text-sm font-semibold text-violet-900">Scheduling Assistant</span>
        </div>
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="text-xs text-violet-500 hover:text-violet-800"
        >
          Close
        </button>
      </div>
      <p className="text-xs text-violet-700">Optimal dates for <strong>{accountName}</strong> based on taster availability and schedule gaps</p>

      {isPending && (
        <div className="flex items-center gap-2 text-sm text-violet-600 py-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          Finding best slots…
        </div>
      )}

      {error && (
        <div className="flex items-center gap-1.5 text-sm text-red-600">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {suggestions !== null && !isPending && (
        <>
          {suggestions.length === 0 ? (
            <p className="text-sm text-slate-500 py-2">No available slots found in the next 45 days. All tasters are booked.</p>
          ) : (
            <div className="space-y-2">
              {suggestions.map((s, i) => (
                <div
                  key={s.date}
                  className="flex items-center justify-between gap-3 rounded-lg bg-white border border-violet-100 px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Calendar className="w-3.5 h-3.5 text-violet-500 shrink-0" />
                      <span className="text-sm font-medium text-slate-900">{s.dayLabel}</span>
                      {i === 0 && (
                        <Badge variant="outline" className="text-xs text-violet-700 border-violet-300 bg-violet-50">Best pick</Badge>
                      )}
                      {s.conflictCount > 0 && (
                        <span className="text-xs text-slate-400">{s.conflictCount} other tasting{s.conflictCount !== 1 ? 's' : ''} this day</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Users className="w-3 h-3 text-slate-400" />
                      <span className="text-xs text-slate-500">
                        {s.availableTasters.slice(0, 3).map(t => t.name).join(', ')}
                        {s.availableTasters.length > 3 && ` +${s.availableTasters.length - 3} more`}
                      </span>
                    </div>
                  </div>
                  {onSelectSlot && s.availableTasters[0] && (
                    <button
                      type="button"
                      onClick={() => onSelectSlot(s.date, s.availableTasters[0].id)}
                      className="flex items-center gap-1 text-xs font-medium text-violet-700 hover:text-violet-900 shrink-0"
                    >
                      Use <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleGenerate}
            className="text-xs text-violet-600 hover:text-violet-800 hover:bg-violet-100 px-2 py-1 h-auto"
          >
            Refresh suggestions
          </Button>
        </>
      )}
    </div>
  )
}
