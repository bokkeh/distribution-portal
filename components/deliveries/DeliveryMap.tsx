'use client'

import { GoogleMap, Marker, Polyline, InfoWindow, useJsApiLoader } from '@react-google-maps/api'
import { useState } from 'react'

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

const STATUS_COLORS: Record<string, string> = {
  pending: '#3B82F6',
  delivered: '#22C55E',
  failed: '#EF4444',
}

export default function DeliveryMap({ stops }: { stops: Stop[] }) {
  const [selectedStop, setSelectedStop] = useState<Stop | null>(null)

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? '',
  })

  const validStops = stops.filter(s => s.lat !== 0 && s.lng !== 0)

  const activeStop = selectedStop ?? validStops[0] ?? null
  const center = activeStop
    ? { lat: activeStop.lat, lng: activeStop.lng }
    : { lat: 29.7604, lng: -95.3698 } // Houston default

  const path = validStops.map(s => ({ lat: s.lat, lng: s.lng }))

  if (!isLoaded) return <div className="w-full h-full flex items-center justify-center bg-slate-100"><p className="text-sm text-muted-foreground">Loading map...</p></div>

  return (
    <GoogleMap
      mapContainerStyle={{ width: '100%', height: '100%' }}
      center={center}
      zoom={selectedStop ? 14 : validStops.length > 1 ? 11 : 13}
    >
      {validStops.map((stop) => (
        <Marker
          key={stop.id}
          position={{ lat: stop.lat, lng: stop.lng }}
          label={{ text: stop.label, color: 'white', fontWeight: 'bold', fontSize: '12px' }}
          icon={{
            path: google.maps.SymbolPath.CIRCLE,
            fillColor: STATUS_COLORS[stop.status] ?? '#3B82F6',
            fillOpacity: 1,
            strokeWeight: 2,
            strokeColor: 'white',
            scale: 16,
          }}
          onClick={() => setSelectedStop(stop)}
        />
      ))}
      {path.length > 1 && (
        <Polyline
          path={path}
          options={{ strokeColor: '#DC2626', strokeWeight: 5, strokeOpacity: 0.95, geodesic: true }}
        />
      )}
      {selectedStop && (
        <InfoWindow
          position={{ lat: selectedStop.lat, lng: selectedStop.lng }}
          onCloseClick={() => setSelectedStop(null)}
        >
          <div className="p-1 min-w-36">
            <p className="font-semibold text-sm">{selectedStop.title}</p>
            <p className="text-xs text-gray-600 mt-0.5">{selectedStop.address}</p>
            {selectedStop.contactName && (
              <p className="text-xs text-gray-600 mt-1">POC: {selectedStop.contactName}</p>
            )}
            {selectedStop.contactPhone && (
              <p className="text-xs text-gray-600">{selectedStop.contactPhone}</p>
            )}
            <p className="text-xs font-medium mt-1 capitalize" style={{ color: STATUS_COLORS[selectedStop.status] }}>
              {selectedStop.status}
            </p>
          </div>
        </InfoWindow>
      )}
    </GoogleMap>
  )
}
