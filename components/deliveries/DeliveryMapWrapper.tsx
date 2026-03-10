'use client'

import dynamic from 'next/dynamic'

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
  status: string
}

export default function DeliveryMapWrapper({ stops }: { stops: Stop[] }) {
  return <DeliveryMap stops={stops} />
}
