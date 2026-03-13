'use client'

import { DirectionsRenderer, GoogleMap, InfoWindow, Marker, Polyline, useJsApiLoader } from '@react-google-maps/api'
import { useEffect, useState } from 'react'

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

const STATUS_COLORS: Record<string, string> = {
  pending: '#3B82F6',
  delivered: '#22C55E',
  failed: '#EF4444',
}

function haversineMiles(a: Stop, b: Stop) {
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

export default function DeliveryMap({
  stops,
  origin,
  onEstimateChange,
}: {
  stops: Stop[]
  origin?: Origin | null
  onEstimateChange?: (estimate: string | null) => void
}) {
  const [selectedStop, setSelectedStop] = useState<Stop | null>(null)
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null)
  const [lineOffset, setLineOffset] = useState('0%')

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? '',
  })

  const validStops = stops.filter(s => s.lat !== 0 && s.lng !== 0)
  const originPoint = origin && origin.lat !== 0 && origin.lng !== 0 ? origin : null
  const routeKey = validStops.map(stop => `${stop.id}:${stop.lat}:${stop.lng}`).join('|')
  const fallbackPath = [
    ...(originPoint ? [{ lat: originPoint.lat, lng: originPoint.lng }] : []),
    ...validStops.map(stop => ({ lat: stop.lat, lng: stop.lng })),
  ]

  const activeStop = selectedStop ?? validStops[0] ?? null
  const center = selectedStop
    ? { lat: selectedStop.lat, lng: selectedStop.lng }
    : originPoint
      ? { lat: originPoint.lat, lng: originPoint.lng }
      : activeStop
        ? { lat: activeStop.lat, lng: activeStop.lng }
    : { lat: 29.7604, lng: -95.3698 } // Houston default
  const totalDurationSeconds = directions?.routes[0]?.legs?.reduce((sum, leg) => sum + (leg.duration?.value ?? 0), 0) ?? 0
  const durationStops = originPoint
    ? [
        { id: 'origin', lat: originPoint.lat, lng: originPoint.lng, label: 'H', title: originPoint.title, address: originPoint.address, status: 'pending' },
        ...validStops,
      ]
    : validStops
  const fallbackDurationSeconds = durationStops.length > 1
    ? durationStops.slice(1).reduce((sum, stop, index) => sum + ((haversineMiles(durationStops[index], stop) / 30) * 3600), 0)
    : 0
  const durationSeconds = totalDurationSeconds || fallbackDurationSeconds
  const estimatedTravelTime = totalDurationSeconds > 0
    ? durationSeconds >= 3600
      ? `${Math.floor(durationSeconds / 3600)}h ${Math.round((durationSeconds % 3600) / 60)}m`
      : `${Math.round(durationSeconds / 60)} min`
    : fallbackDurationSeconds > 0
      ? `~${Math.round(fallbackDurationSeconds / 60)} min`
    : null

  useEffect(() => {
    onEstimateChange?.(estimatedTravelTime)
  }, [estimatedTravelTime, onEstimateChange])

  useEffect(() => {
    const interval = window.setInterval(() => {
      setLineOffset(current => {
        const next = (parseFloat(current) + 4) % 100
        return `${next}%`
      })
    }, 180)

    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!isLoaded || validStops.length === 0 || (!originPoint && validStops.length < 2)) {
      setDirections(null)
      return
    }

    const directionsService = new google.maps.DirectionsService()
    const routeOrigin = originPoint
      ? { lat: originPoint.lat, lng: originPoint.lng }
      : { lat: validStops[0].lat, lng: validStops[0].lng }
    const destination = { lat: validStops[validStops.length - 1].lat, lng: validStops[validStops.length - 1].lng }
    const waypoints = (originPoint ? validStops : validStops.slice(1)).slice(0, -1).map(stop => ({
      location: { lat: stop.lat, lng: stop.lng },
      stopover: true,
    }))

    directionsService.route(
      {
        origin: routeOrigin,
        destination,
        waypoints,
        optimizeWaypoints: waypoints.length > 0,
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === google.maps.DirectionsStatus.OK && result) {
          setDirections(result)
          return
        }

        setDirections(null)
      }
    )
  }, [isLoaded, routeKey, originPoint?.lat, originPoint?.lng])

  if (!isLoaded) return <div className="w-full h-full flex items-center justify-center bg-slate-100"><p className="text-sm text-muted-foreground">Loading map...</p></div>

  return (
    <div className="relative h-full w-full">
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
        {directions && (
          <DirectionsRenderer
            directions={directions}
            options={{
              preserveViewport: true,
              suppressMarkers: true,
              polylineOptions: {
                strokeColor: 'rgba(0,0,0,0)',
                strokeWeight: 5,
                strokeOpacity: 0,
                icons: [
                  {
                    icon: {
                      path: 'M 0,-1 0,1',
                      strokeOpacity: 1,
                      strokeColor: '#DC2626',
                      scale: 4,
                    },
                    offset: lineOffset,
                    repeat: '18px',
                  },
                ],
              },
            }}
          />
        )}
        {!directions && fallbackPath.length > 1 && (
          <Polyline
            path={fallbackPath}
            options={{
              strokeColor: 'rgba(0,0,0,0)',
              strokeWeight: 5,
              strokeOpacity: 0,
              geodesic: true,
              icons: [
                {
                  icon: {
                    path: 'M 0,-1 0,1',
                    strokeOpacity: 1,
                    strokeColor: '#DC2626',
                    scale: 4,
                  },
                  offset: lineOffset,
                  repeat: '18px',
                },
              ],
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
              <p className="text-xs font-medium mt-1 capitalize" style={{ color: STATUS_COLORS[selectedStop.status] }}>
                {selectedStop.status}
              </p>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>
    </div>
  )
}
