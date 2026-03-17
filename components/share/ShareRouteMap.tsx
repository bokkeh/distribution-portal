'use client'

import dynamic from 'next/dynamic'

const ShareRouteMapInner = dynamic(() => import('./ShareRouteMapInner'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-slate-100">
      <p className="text-sm text-slate-500">Loading map...</p>
    </div>
  ),
})

export type ShareStop = {
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

export type ShareOrigin = { lat: number; lng: number; address: string } | null

export default function ShareRouteMap({ stops, origin }: { stops: ShareStop[]; origin?: ShareOrigin }) {
  return (
    <div className="w-full h-full">
      <ShareRouteMapInner stops={stops} origin={origin} />
    </div>
  )
}
