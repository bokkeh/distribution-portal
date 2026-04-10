'use client'

import { GoogleMap, InfoWindow, Marker, Polyline, useJsApiLoader } from '@react-google-maps/api'
import { useEffect, useRef, useState } from 'react'
import type { ShareStop } from './ShareRouteMap'
import { Button } from '@/components/ui/button'
import { Route, TriangleAlert } from 'lucide-react'

const STATUS_COLORS: Record<string, string> = {
  pending: '#3B82F6',
  delivered: '#22C55E',
  failed: '#EF4444',
}

export default function ShareRouteMapInner({ stops, origin }: { stops: ShareStop[]; origin?: { lat: number; lng: number; address: string } | null }) {
  const [selectedStop, setSelectedStop] = useState<ShareStop | null>(null)
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null)
  const [directionsAvailable, setDirectionsAvailable] = useState(true)
  const [directionsEnabled, setDirectionsEnabled] = useState(false)
  const mapRef = useRef<google.maps.Map | null>(null)

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? '',
  })

  const validStops = stops.filter((s) => s.lat !== 0 && s.lng !== 0)
  const originKey = origin ? `${origin.lat}:${origin.lng}` : ''
  const routeKey = validStops.map((s) => `${s.id}:${s.lat}:${s.lng}`).join('|')

  // Fit map to all stops + origin whenever they change
  useEffect(() => {
    if (!mapRef.current || !isLoaded) return
    const points = [...validStops.map(s => ({ lat: s.lat, lng: s.lng })), ...(origin ? [{ lat: origin.lat, lng: origin.lng }] : [])]
    if (points.length === 0) return
    const bounds = new google.maps.LatLngBounds()
    points.forEach((p) => bounds.extend(p))
    mapRef.current.fitBounds(bounds, 60)
  }, [routeKey, origin, originKey, isLoaded, validStops])

  // Fetch directions
  useEffect(() => {
    if (!directionsEnabled || !directionsAvailable || !isLoaded || validStops.length < 2) return

    const service = new google.maps.DirectionsService()
    const routeOrigin = origin
      ? { lat: origin.lat, lng: origin.lng }
      : { lat: validStops[0].lat, lng: validStops[0].lng }
    const destination = { lat: validStops[validStops.length - 1].lat, lng: validStops[validStops.length - 1].lng }
    const waypointStops = origin ? validStops : validStops.slice(1, -1)
    const waypoints = waypointStops.map((s) => ({
      location: { lat: s.lat, lng: s.lng },
      stopover: true,
    }))

    service.route(
      {
        origin: routeOrigin,
        destination,
        waypoints,
        optimizeWaypoints: false,
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === google.maps.DirectionsStatus.OK && result) {
          setDirections(result)
        } else {
          if (
            status === google.maps.DirectionsStatus.REQUEST_DENIED ||
            status === google.maps.DirectionsStatus.OVER_QUERY_LIMIT
          ) {
            setDirectionsAvailable(false)
          }
          setDirections(null)
        }
      }
    )
  }, [directionsAvailable, directionsEnabled, isLoaded, origin, originKey, routeKey, validStops])

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
      {!directionsEnabled && validStops.length > 1 ? (
        <div className="absolute left-3 top-3 z-10 max-w-sm rounded-xl border border-red-200 bg-white/95 p-3 shadow-lg">
          <div className="flex items-start gap-2">
            <TriangleAlert className="mt-0.5 h-4 w-4 text-red-600" />
            <div className="space-y-2">
              <p className="text-sm font-semibold text-red-700">Live directions are billable</p>
              <p className="text-xs text-slate-600">Loading a routed path on this shared map uses Google Directions API requests.</p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-red-200 text-red-700 hover:bg-red-50"
                onClick={() => {
                  const confirmed = window.confirm('Load live directions for this shared route? This will make a billable Google Directions API request.')
                  if (confirmed) setDirectionsEnabled(true)
                }}
              >
                <Route className="h-3.5 w-3.5" />
                Load Live Directions
              </Button>
            </div>
          </div>
        </div>
      ) : null}
      <GoogleMap
        mapContainerStyle={{ width: '100%', height: '100%' }}
        center={validStops[0] ? { lat: validStops[0].lat, lng: validStops[0].lng } : { lat: 29.7604, lng: -95.3698 }}
        zoom={11}
        options={{ gestureHandling: 'greedy', draggableCursor: 'grab', draggingCursor: 'grabbing' }}
        onLoad={(map) => { mapRef.current = map }}
      >
        {origin && (
          <Marker
            position={{ lat: origin.lat, lng: origin.lng }}
            label={{ text: 'H', color: 'white', fontWeight: 'bold', fontSize: '11px' }}
            icon={{
              path: google.maps.SymbolPath.CIRCLE,
              fillColor: '#0F172A',
              fillOpacity: 1,
              strokeWeight: 2,
              strokeColor: 'white',
              scale: 14,
            }}
            title={origin.address}
          />
        )}
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
