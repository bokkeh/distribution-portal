'use client'

import { GoogleMap, InfoWindow, Marker, Polyline, useJsApiLoader } from '@react-google-maps/api'
import { useEffect, useRef, useState } from 'react'
import type { ShareStop } from './ShareRouteMap'

const STATUS_COLORS: Record<string, string> = {
  pending: '#3B82F6',
  delivered: '#22C55E',
  failed: '#EF4444',
}

export default function ShareRouteMapInner({ stops }: { stops: ShareStop[] }) {
  const [selectedStop, setSelectedStop] = useState<ShareStop | null>(null)
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null)
  const mapRef = useRef<google.maps.Map | null>(null)

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? '',
  })

  const validStops = stops.filter((s) => s.lat !== 0 && s.lng !== 0)
  const routeKey = validStops.map((s) => `${s.id}:${s.lat}:${s.lng}`).join('|')

  // Fit map to all stops whenever stops change
  useEffect(() => {
    if (!mapRef.current || validStops.length === 0) return
    const bounds = new google.maps.LatLngBounds()
    validStops.forEach((s) => bounds.extend({ lat: s.lat, lng: s.lng }))
    mapRef.current.fitBounds(bounds, 60)
  }, [routeKey, isLoaded])

  // Fetch directions
  useEffect(() => {
    if (!isLoaded || validStops.length < 2) {
      setDirections(null)
      return
    }

    const service = new google.maps.DirectionsService()
    const origin = { lat: validStops[0].lat, lng: validStops[0].lng }
    const destination = { lat: validStops[validStops.length - 1].lat, lng: validStops[validStops.length - 1].lng }
    const waypoints = validStops.slice(1, -1).map((s) => ({
      location: { lat: s.lat, lng: s.lng },
      stopover: true,
    }))

    service.route(
      {
        origin,
        destination,
        waypoints,
        optimizeWaypoints: false,
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === google.maps.DirectionsStatus.OK && result) {
          setDirections(result)
        } else {
          setDirections(null)
        }
      }
    )
  }, [isLoaded, routeKey])

  if (!isLoaded) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-100">
        <p className="text-sm text-slate-500">Loading map...</p>
      </div>
    )
  }

  const fallbackPath = validStops.map((s) => ({ lat: s.lat, lng: s.lng }))
  const directionsPath =
    directions?.routes[0]?.overview_path?.map((p) => ({ lat: p.lat(), lng: p.lng() })) ?? []
  const renderedPath = directionsPath.length > 1 ? directionsPath : fallbackPath

  return (
    <div className="relative h-full w-full">
      <GoogleMap
        mapContainerStyle={{ width: '100%', height: '100%' }}
        center={validStops[0] ? { lat: validStops[0].lat, lng: validStops[0].lng } : { lat: 29.7604, lng: -95.3698 }}
        zoom={11}
        options={{ gestureHandling: 'greedy', draggableCursor: 'grab', draggingCursor: 'grabbing' }}
        onLoad={(map) => { mapRef.current = map }}
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

        {renderedPath.length > 1 && (
          <Polyline
            path={renderedPath}
            options={{
              clickable: false,
              strokeColor: '#DC2626',
              strokeWeight: 5,
              strokeOpacity: 0.95,
              geodesic: true,
            }}
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
            </div>
          </InfoWindow>
        )}
      </GoogleMap>
    </div>
  )
}
