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

export default function SalesRouteMapAndList({
  routeId,
  initialStops,
}: {
  routeId: string
  initialStops: RouteStop[]
}) {
  const [stops, setStops] = useState(initialStops)

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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="lg:col-span-1">
        <CardHeader><CardTitle>Route Map</CardTitle></CardHeader>
        <CardContent className="p-0 h-96 rounded-b-xl overflow-hidden">
          <SalesRouteMapWrapper stops={mapStops} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{stops.length} {stops.length === 1 ? 'Stop' : 'Stops'}</CardTitle>
          <p className="text-sm text-muted-foreground">
            Drag to reorder. The map updates live as you change the order.
          </p>
        </CardHeader>
        <CardContent className="max-h-[32rem] overflow-y-auto">
          <SortableSalesStopList
            routeId={routeId}
            stops={stops}
            onStopsChange={setStops}
          />
        </CardContent>
      </Card>
    </div>
  )
}
