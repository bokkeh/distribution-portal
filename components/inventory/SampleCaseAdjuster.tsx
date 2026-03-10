'use client'

import { useTransition, useState } from 'react'
import { toast } from 'sonner'
import { adjustSampleCases } from '@/actions/inventory'
import { Minus, Plus } from 'lucide-react'

export function SampleCaseAdjuster({
  productId,
  initialQty,
}: {
  productId: string
  initialQty: number
}) {
  const [qty, setQty] = useState(initialQty)
  const [isPending, startTransition] = useTransition()

  function adjust(delta: number) {
    const next = Math.max(0, qty + delta)
    if (next === qty) return

    setQty(next)
    startTransition(async () => {
      const result = await adjustSampleCases(productId, delta)
      if (result.error) {
        setQty(qty) // revert
        toast.error('Adjustment failed', { description: result.error })
      } else {
        toast.success(`Sample cases updated → ${next}`, {
          description: 'Kris has been notified by email.',
        })
      }
    })
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => adjust(-1)}
        disabled={isPending || qty === 0}
        className="w-7 h-7 rounded-md border border-slate-200 flex items-center justify-center hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        aria-label="Remove one sample case"
      >
        <Minus className="w-3 h-3" />
      </button>
      <span className={`w-6 text-center text-sm font-semibold tabular-nums ${isPending ? 'opacity-50' : ''}`}>
        {qty}
      </span>
      <button
        onClick={() => adjust(1)}
        disabled={isPending}
        className="w-7 h-7 rounded-md border border-slate-200 flex items-center justify-center hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        aria-label="Add one sample case"
      >
        <Plus className="w-3 h-3" />
      </button>
    </div>
  )
}
