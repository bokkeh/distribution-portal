'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import type { SalesStop } from './SalesRouteMapInner'

const SalesRouteMapInner = dynamic(() => import('./SalesRouteMapInner'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-slate-100">
      <p className="text-sm text-muted-foreground">Loading map...</p>
    </div>
  ),
})

export default function SalesRouteMapWrapper({ stops }: { stops: SalesStop[] }) {
  const [estimate, setEstimate] = useState<string | null>(null)

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Estimated Drive Time
        </p>
        <p className="text-sm font-semibold text-slate-900">
          {estimate ?? 'Calculating route...'}
        </p>
      </div>
      <div className="min-h-0 flex-1">
        <SalesRouteMapInner stops={stops} onEstimateChange={setEstimate} />
      </div>
    </div>
  )
}
