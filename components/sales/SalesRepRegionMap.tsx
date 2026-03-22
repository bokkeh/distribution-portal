'use client'

import { GoogleMap, InfoWindow, Marker, Polygon, useJsApiLoader } from '@react-google-maps/api'
import { useState, useMemo, useCallback, useRef } from 'react'
import { MapPin, Building2, Phone, CalendarDays, TrendingUp, Wine } from 'lucide-react'
import type { RepMapAccount, RepMapData } from '@/actions/sales-rep-map'
import { convexHull, expandHull, circlePolygon } from '@/lib/maps/convex-hull'

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function getHealthColor(account: RepMapAccount): string {
  if (!account.lastVisitDate) return '#EF4444'
  const daysSince = (Date.now() - new Date(account.lastVisitDate).getTime()) / 86400000
  const freq = account.visitFrequency ?? 30
  const staleness = daysSince / freq
  if (staleness < 0.75) return '#22C55E'
  if (staleness < 1.0)  return '#84CC16'
  if (staleness < 1.5)  return '#F59E0B'
  if (staleness < 2.5)  return '#F97316'
  return '#EF4444'
}

function getHealthLabel(account: RepMapAccount): string {
  if (!account.lastVisitDate) return 'Never visited'
  const daysSince = (Date.now() - new Date(account.lastVisitDate).getTime()) / 86400000
  const freq = account.visitFrequency ?? 30
  const staleness = daysSince / freq
  if (staleness < 0.75) return 'Healthy'
  if (staleness < 1.0)  return 'Due soon'
  if (staleness < 1.5)  return 'Overdue'
  if (staleness < 2.5)  return 'At risk'
  return 'Critical'
}

const REGION_COLOR = '#6366F1' // indigo

export function SalesRepRegionMap({ data }: { data: RepMapData }) {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? '',
  })

  const mapRef = useRef<google.maps.Map | null>(null)
  const [selected, setSelected] = useState<RepMapAccount | null>(null)

  const accountsWithCoords = useMemo(
    () => data.accounts.filter(a => a.lat != null && a.lng != null),
    [data.accounts]
  )

  // Convex hull polygon for the region
  const regionPolygon = useMemo(() => {
    const pts = accountsWithCoords.map(a => ({ lat: a.lat!, lng: a.lng! }))
    if (pts.length === 0) return null
    if (pts.length === 1) return circlePolygon(pts[0], 0.02)
    if (pts.length === 2) {
      const centre = { lat: (pts[0].lat + pts[1].lat) / 2, lng: (pts[0].lng + pts[1].lng) / 2 }
      return circlePolygon(centre, 0.02)
    }
    return expandHull(convexHull(pts), 0.016)
  }, [accountsWithCoords])

  // Auto-fit bounds to all accounts when map loads
  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map
    if (accountsWithCoords.length === 0) return
    const bounds = new window.google.maps.LatLngBounds()
    accountsWithCoords.forEach(a => bounds.extend({ lat: a.lat!, lng: a.lng! }))
    map.fitBounds(bounds, { top: 60, right: 40, bottom: 40, left: 40 })
  }, [accountsWithCoords])

  if (!isLoaded) {
    return (
      <div className="h-[500px] rounded-2xl bg-slate-100 flex items-center justify-center">
        <div className="text-slate-400 text-sm">Loading map…</div>
      </div>
    )
  }

  if (accountsWithCoords.length === 0) {
    return (
      <div className="h-[500px] rounded-2xl bg-slate-50 border border-slate-200 flex flex-col items-center justify-center gap-3 text-slate-400">
        <MapPin className="w-10 h-10 opacity-30" />
        <p className="text-sm">No geocoded accounts in your region yet.</p>
        <p className="text-xs">Ask an admin to geocode accounts from the Regions map.</p>
      </div>
    )
  }

  return (
    <GoogleMap
      mapContainerClassName="w-full h-[500px] rounded-2xl overflow-hidden"
      onLoad={onMapLoad}
      options={{
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        zoomControl: true,
        styles: [
          { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
        ],
      }}
    >
      {/* Region polygon */}
      {regionPolygon && (
        <Polygon
          paths={regionPolygon}
          options={{
            fillColor: REGION_COLOR,
            fillOpacity: 0.08,
            strokeColor: REGION_COLOR,
            strokeOpacity: 0.5,
            strokeWeight: 2,
          }}
        />
      )}

      {/* Account markers */}
      {accountsWithCoords.map(account => (
        <Marker
          key={account.id}
          position={{ lat: account.lat!, lng: account.lng! }}
          onClick={() => setSelected(account)}
          icon={{
            path: google.maps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: getHealthColor(account),
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2,
          }}
          title={account.companyName}
        />
      ))}

      {/* Info popup */}
      {selected && selected.lat && selected.lng && (
        <InfoWindow
          position={{ lat: selected.lat, lng: selected.lng }}
          onCloseClick={() => setSelected(null)}
          options={{ pixelOffset: new window.google.maps.Size(0, -14) }}
        >
          <div className="min-w-[220px] max-w-[260px] font-sans">
            <div className="flex items-start justify-between gap-2 mb-2">
              <p className="font-semibold text-slate-900 text-sm leading-tight">{selected.companyName}</p>
              <span
                className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full text-white"
                style={{ backgroundColor: getHealthColor(selected) }}
              >
                {getHealthLabel(selected)}
              </span>
            </div>

            {(selected.address || selected.city) && (
              <p className="text-xs text-slate-500 mb-2">
                {[selected.address, selected.city, selected.state].filter(Boolean).join(', ')}
              </p>
            )}

            <div className="grid grid-cols-3 gap-1 mb-2 text-center">
              <div className="bg-slate-50 rounded-lg p-1.5">
                <TrendingUp className="w-3 h-3 text-emerald-500 mx-auto mb-0.5" />
                <p className="text-[10px] font-semibold text-slate-700">{fmt(selected.revenue)}</p>
                <p className="text-[9px] text-slate-400">Revenue</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-1.5">
                <Wine className="w-3 h-3 text-violet-500 mx-auto mb-0.5" />
                <p className="text-[10px] font-semibold text-slate-700">{selected.tastingCount}</p>
                <p className="text-[9px] text-slate-400">Tastings</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-1.5">
                <CalendarDays className="w-3 h-3 text-blue-500 mx-auto mb-0.5" />
                <p className="text-[10px] font-semibold text-slate-700">
                  {selected.visitFrequency ? `${selected.visitFrequency}d` : '—'}
                </p>
                <p className="text-[9px] text-slate-400">Frequency</p>
              </div>
            </div>

            {selected.lastVisitDate && (
              <p className="text-[10px] text-slate-400 mb-2">
                Last visit: {new Date(selected.lastVisitDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            )}

            {selected.phone && (
              <a
                href={`tel:${selected.phone}`}
                className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
              >
                <Phone className="w-3 h-3" /> {selected.phone}
              </a>
            )}

            <a
              href={`/sales/accounts/${selected.id}`}
              className="mt-2 flex items-center justify-center gap-1 w-full rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold py-1.5 transition-colors"
            >
              <Building2 className="w-3 h-3" /> View Account
            </a>
          </div>
        </InfoWindow>
      )}
    </GoogleMap>
  )
}
