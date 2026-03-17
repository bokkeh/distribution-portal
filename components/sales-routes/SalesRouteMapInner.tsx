'use client'

import { GoogleMap, InfoWindow, Marker, Polyline, useJsApiLoader } from '@react-google-maps/api'
import { useEffect, useRef, useState } from 'react'

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
  const mapRef = useRef<google.maps.Map | null>(null)

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? '',
  })

  const validStops = stops.filter((s) => s.lat !== 0 && s.lng !== 0)
  const originPoint = origin && origin.lat !== 0 && origin.lng !== 0 ? origin : null
  const routeKey = validStops.map((s) => `${s.id}:${s.lat}:${s.lng}`).join('|')
  const originKey = originPoint ? `${originPoint.lat}:${originPoint.lng}` : ''

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
  }, [routeKey, originKey, isLoaded])

  // Fetch directions in the order stops are given — no waypoint reordering
  useEffect(() => {
    if (!isLoaded || (validStops.length < 2 && (!originPoint || validStops.length < 1))) {
      setDirections(null)
      onEstimateChange?.(null)
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
          const totalSecs = result.routes[0]?.legs?.reduce(
            (sum, leg) => sum + (leg.duration?.value ?? 0),
            0
          ) ?? 0
          if (totalSecs > 0) {
            const estimate =
              totalSecs >= 3600
                ? `${Math.floor(totalSecs / 3600)}h ${Math.round((totalSecs % 3600) / 60)}m`
                : `${Math.round(totalSecs / 60)} min`
            onEstimateChange?.(estimate)
          } else {
            onEstimateChange?.(null)
          }
        } else {
          setDirections(null)
          onEstimateChange?.(null)
        }
      }
    )
  }, [isLoaded, routeKey, originKey])

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
