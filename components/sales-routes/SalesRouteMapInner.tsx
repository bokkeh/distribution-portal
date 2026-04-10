'use client'

import { GoogleMap, InfoWindow, Marker, Polyline, useJsApiLoader } from '@react-google-maps/api'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Route, TriangleAlert } from 'lucide-react'

export interface SalesStop {
  id: string
  lat: number
  lng: number
  label: string
  title: string
  address: string
  contactName?: string | null
  contactPhone?: string | null
}

interface Origin {
  lat: number
  lng: number
  title: string
  address: string
}

function haversineMiles(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const toRadians = (degrees: number) => degrees * (Math.PI / 180)
  const earthRadiusMiles = 3958.8
  const dLat = toRadians(b.lat - a.lat)
  const dLng = toRadians(b.lng - a.lng)
  const lat1 = toRadians(a.lat)
  const lat2 = toRadians(b.lat)

  const sinLat = Math.sin(dLat / 2)
  const sinLng = Math.sin(dLng / 2)
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng
  return 2 * earthRadiusMiles * Math.asin(Math.sqrt(h))
}

export default function SalesRouteMapInner({
  stops,
  origin,
  onEstimateChange,
}: {
  stops: SalesStop[]
  origin?: Origin | null
  onEstimateChange?: (estimate: string | null) => void
}) {
  const [selectedStop, setSelectedStop] = useState<SalesStop | null>(null)
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null)
  const [directionsAvailable, setDirectionsAvailable] = useState(true)
  const [directionsEnabled, setDirectionsEnabled] = useState(false)
  const mapRef = useRef<google.maps.Map | null>(null)

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? '',
  })

  const validStops = stops.filter((s) => s.lat !== 0 && s.lng !== 0)
  const originPoint = origin && origin.lat !== 0 && origin.lng !== 0 ? origin : null
  const routeKey = validStops.map((s) => `${s.id}:${s.lat}:${s.lng}`).join('|')
  const originKey = originPoint ? `${originPoint.lat}:${originPoint.lng}` : ''
  const totalPointCount = validStops.length + (originPoint ? 1 : 0)
  const exceedsDirectionsWaypointLimit = totalPointCount > 25

  // Auto-fit bounds whenever stops change
  useEffect(() => {
    if (!mapRef.current || !isLoaded) return
    const allPoints = [
      ...(originPoint ? [{ lat: originPoint.lat, lng: originPoint.lng }] : []),
      ...validStops.map((s) => ({ lat: s.lat, lng: s.lng })),
    ]
    if (allPoints.length === 0) return
    const bounds = new google.maps.LatLngBounds()
    allPoints.forEach((p) => bounds.extend(p))
    mapRef.current.fitBounds(bounds, 60)
  }, [routeKey, originKey, isLoaded, originPoint, validStops])

  const totalDurationSeconds =
    directions?.routes[0]?.legs?.reduce((sum, leg) => sum + (leg.duration?.value ?? 0), 0) ?? 0
  const durationStops = originPoint
    ? [{ lat: originPoint.lat, lng: originPoint.lng }, ...validStops.map((stop) => ({ lat: stop.lat, lng: stop.lng }))]
    : validStops.map((stop) => ({ lat: stop.lat, lng: stop.lng }))
  const fallbackDurationSeconds =
    durationStops.length > 1
      ? durationStops.slice(1).reduce((sum, stop, index) => sum + ((haversineMiles(durationStops[index], stop) / 30) * 3600), 0)
      : 0
  const durationSeconds = totalDurationSeconds || fallbackDurationSeconds
  const estimatedTravelTime =
    totalDurationSeconds > 0
      ? durationSeconds >= 3600
        ? `${Math.floor(durationSeconds / 3600)}h ${Math.round((durationSeconds % 3600) / 60)}m`
        : `${Math.round(durationSeconds / 60)} min`
      : fallbackDurationSeconds > 0
        ? `~${Math.round(fallbackDurationSeconds / 60)} min`
        : null

  useEffect(() => {
    onEstimateChange?.(estimatedTravelTime)
  }, [estimatedTravelTime, onEstimateChange])

  // Fetch directions in the order stops are given — no waypoint reordering
  useEffect(() => {
    if (!directionsEnabled || !directionsAvailable || !isLoaded || (validStops.length < 2 && (!originPoint || validStops.length < 1))) return

    if (exceedsDirectionsWaypointLimit) {
      return
    }

    const service = new google.maps.DirectionsService()
    const routeOrigin = originPoint
      ? { lat: originPoint.lat, lng: originPoint.lng }
      : { lat: validStops[0].lat, lng: validStops[0].lng }
    const destination = {
      lat: validStops[validStops.length - 1].lat,
      lng: validStops[validStops.length - 1].lng,
    }
    const middleStops = originPoint ? validStops.slice(0, -1) : validStops.slice(1, -1)
    const waypoints = middleStops.map((s) => ({
      location: { lat: s.lat, lng: s.lng },
      stopover: true,
    }))

    service.route(
      {
        origin: routeOrigin,
        destination,
        waypoints,
        optimizeWaypoints: false, // order is set by "Generate Best Route"
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
  }, [directionsAvailable, directionsEnabled, exceedsDirectionsWaypointLimit, isLoaded, originKey, originPoint, routeKey, validStops])

  if (!isLoaded) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-100">
        <p className="text-sm text-muted-foreground">Loading map...</p>
      </div>
    )
  }

  const fallbackPath = [
    ...(originPoint ? [{ lat: originPoint.lat, lng: originPoint.lng }] : []),
    ...validStops.map((s) => ({ lat: s.lat, lng: s.lng })),
  ]
  const directionsPath =
    directions?.routes[0]?.overview_path?.map((p) => ({ lat: p.lat(), lng: p.lng() })) ?? []
  const renderedPath = directionsPath.length > 1 ? directionsPath : fallbackPath

  const defaultCenter = originPoint
    ? { lat: originPoint.lat, lng: originPoint.lng }
    : validStops[0]
      ? { lat: validStops[0].lat, lng: validStops[0].lng }
      : { lat: 29.7604, lng: -95.3698 }

  return (
    <div className="relative h-full w-full">
      {!directionsEnabled && validStops.length > 1 ? (
        <div className="absolute left-3 top-3 z-10 max-w-sm rounded-xl border border-red-200 bg-white/95 p-3 shadow-lg">
          <div className="flex items-start gap-2">
            <TriangleAlert className="mt-0.5 h-4 w-4 text-red-600" />
            <div className="space-y-2">
              <p className="text-sm font-semibold text-red-700">Live directions are billable</p>
              <p className="text-xs text-slate-600">Loading a routed path inside the portal uses Google Directions API requests.</p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-red-200 text-red-700 hover:bg-red-50"
                onClick={() => {
                  const confirmed = window.confirm('Load live in-app directions? This will make a billable Google Directions API request.')
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
        center={defaultCenter}
        zoom={11}
        options={{
          gestureHandling: 'greedy',
          draggableCursor: 'grab',
          draggingCursor: 'grabbing',
        }}
        onLoad={(map) => {
          mapRef.current = map
        }}
      >
        {originPoint && (
          <Marker
            position={{ lat: originPoint.lat, lng: originPoint.lng }}
            label={{ text: 'H', color: 'white', fontWeight: 'bold', fontSize: '12px' }}
            icon={{
              path: google.maps.SymbolPath.CIRCLE,
              fillColor: '#0F172A',
              fillOpacity: 1,
              strokeWeight: 2,
              strokeColor: 'white',
              scale: 18,
            }}
          />
        )}

        {validStops.map((stop) => (
          <Marker
            key={stop.id}
            position={{ lat: stop.lat, lng: stop.lng }}
            label={{ text: stop.label, color: 'white', fontWeight: 'bold', fontSize: '12px' }}
            icon={{
              path: google.maps.SymbolPath.CIRCLE,
              fillColor: '#7C3AED',
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
