'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import SortableSalesStopList from './SortableSalesStopList'
import SalesRouteMapWrapper from './SalesRouteMapWrapper'

export type RouteStop = {
  id: string
  sequenceNumber: number
  address: string
  contactName: string | null
  contactPhone: string | null
  notes: string | null
  companyName: string | null
  lat: number | null
  lng: number | null
}

export type RouteOrigin = {
  address: string
  lat: number
  lng: number
} | null

export default function SalesRouteMapAndList({
  routeId,
  initialStops,
  origin: initialOrigin,
}: {
  routeId: string
  initialStops: RouteStop[]
  origin?: RouteOrigin
}) {
  const [stops, setStops] = useState(initialStops)
  const [origin, setOrigin] = useState<RouteOrigin>(initialOrigin ?? null)

  function handleOriginChange(address: string | null, lat: number | null, lng: number | null) {
    if (!address) { setOrigin(null); return }
    // lat/lng from the HombaseRow are null immediately after save (geocoding happens server-side)
    // we keep whatever was there before if we don't have new coords yet
    setOrigin(prev => address === null ? null : { address, lat: lat ?? prev?.lat ?? 0, lng: lng ?? prev?.lng ?? 0 })
  }

  const mapStops = stops.map((stop, index) => ({
    id: stop.id,
    lat: stop.lat ?? 0,
    lng: stop.lng ?? 0,
    label: String(index + 1),
    title: stop.companyName ?? stop.address,
    address: stop.address,
    contactName: stop.contactName,
    contactPhone: stop.contactPhone,
  }))

  const mapOrigin = origin && origin.lat && origin.lng
    ? { lat: origin.lat, lng: origin.lng, title: 'Starting Location', address: origin.address }
    : null

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card className="flex h-full flex-col lg:col-span-1">
        <CardHeader><CardTitle>Route Map</CardTitle></CardHeader>
        <CardContent className="min-h-[24rem] flex-1 overflow-hidden rounded-b-xl p-0">
          <SalesRouteMapWrapper stops={mapStops} origin={mapOrigin} />
        </CardContent>
      </Card>

      <Card className="flex h-full flex-col">
        <CardHeader>
          <CardTitle>{stops.length} {stops.length === 1 ? 'Stop' : 'Stops'}</CardTitle>
          <p className="text-sm text-muted-foreground">
            Drag to reorder. The map updates live as you change the order.
          </p>
        </CardHeader>
        <CardContent className="max-h-[36rem] flex-1 overflow-y-auto">
          <SortableSalesStopList
            routeId={routeId}
            stops={stops}
            onStopsChange={setStops}
            origin={origin ? { lat: origin.lat, lng: origin.lng } : null}
            originAddress={origin?.address ?? null}
            onOriginChange={handleOriginChange}
          />
        </CardContent>
      </Card>
    </div>
  )
}
