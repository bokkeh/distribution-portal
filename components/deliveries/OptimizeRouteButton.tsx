'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Shuffle } from 'lucide-react'
import { optimizeDeliveryRoute } from '@/actions/deliveries'

export function OptimizeRouteButton({ deliveryId }: { deliveryId: string }) {
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<{ success?: boolean; error?: string } | null>(null)

  function handleOptimize() {
    const confirmed = window.confirm(
      'This will make a billable Google Directions API optimization request. Continue?'
    )
    if (!confirmed) return

    setResult(null)
    startTransition(async () => {
      const res = await optimizeDeliveryRoute(deliveryId)
      setResult(res)
    })
  }

  return (
    <div className="flex flex-col items-start gap-1.5">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-2"
        onClick={handleOptimize}
        disabled={isPending}
      >
        <Shuffle className="w-4 h-4" />
        {isPending ? 'Optimizing…' : 'Optimize Route'}
      </Button>
      {result?.error && (
        <p className="text-xs text-red-600">{result.error}</p>
      )}
      {result?.success && (
        <p className="text-xs text-emerald-600">Route optimized successfully.</p>
      )}
      <p className="text-xs font-medium text-red-600">Warning: optimization uses a billable Google Directions API call.</p>
    </div>
  )
}
