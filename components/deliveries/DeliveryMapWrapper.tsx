'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'

const DeliveryMap = dynamic(() => import('./DeliveryMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-slate-100">
      <p className="text-sm text-muted-foreground">Loading map...</p>
    </div>
  ),
})

interface Stop {
  id: string
  lat: number
  lng: number
  label: string
  title: string
  address: string
  contactName?: string | null
  contactPhone?: string | null
  status: string
}

interface Origin {
  lat: number
  lng: number
  title: string
  address: string
}

export default function DeliveryMapWrapper({ stops, origin }: { stops: Stop[]; origin?: Origin | null }) {
  const [estimate, setEstimate] = useState<string | null>(null)

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Estimated Drive Time</p>
        <p className="text-sm font-semibold text-slate-900">{estimate ?? 'Calculating route...'}</p>
      </div>
      <div className="min-h-0 flex-1">
        <DeliveryMap stops={stops} origin={origin} onEstimateChange={setEstimate} />
      </div>
    </div>
  )
}
