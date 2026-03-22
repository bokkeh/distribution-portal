'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MapPin, MapPinned, Navigation, Phone, Store } from 'lucide-react'
import { formatEasternDate, formatEasternTimeRange } from '@/lib/tastings/time'

type TastingMapRow = {
  id: string
  eventName: string
  scheduledAt: Date
  endAt: Date | null
  status: string
  storeAddress: string | null
  storeCity: string | null
  storeState: string | null
  storeZip: string | null
  storePhone: string | null
}

const statusVariant: Record<string, 'secondary' | 'success' | 'warning' | 'destructive' | 'info'> = {
  scheduled: 'info',
  confirmed: 'warning',
  completed: 'success',
  cancelled: 'destructive',
  declined: 'destructive',
}

function buildAddress(tasting: TastingMapRow) {
  return [tasting.storeAddress, tasting.storeCity, tasting.storeState, tasting.storeZip]
    .filter(Boolean)
    .join(', ')
}

function buildDirectionsHref(address: string) {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`
}

function buildEmbedHref(address: string) {
  return `https://maps.google.com/maps?hl=en&q=${encodeURIComponent(address)}&z=14&output=embed`
}

export function TastingMapPanel({ tastings }: { tastings: TastingMapRow[] }) {
  const mappableTastings = useMemo(
    () => tastings.filter((tasting) => buildAddress(tasting)),
    [tastings],
  )
  const [selectedId, setSelectedId] = useState<string | null>(mappableTastings[0]?.id ?? null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [showFallback, setShowFallback] = useState(false)

  const selectedTasting = mappableTastings.find((tasting) => tasting.id === selectedId) ?? mappableTastings[0] ?? null
  const selectedAddress = selectedTasting ? buildAddress(selectedTasting) : ''

  useEffect(() => {
    setMapLoaded(false)
    setShowFallback(false)
  }, [selectedId, selectedAddress])

  useEffect(() => {
    if (!selectedTasting) return
    const timeout = window.setTimeout(() => {
      setShowFallback(true)
    }, 3500)
    return () => window.clearTimeout(timeout)
  }, [selectedTasting])

  if (!mappableTastings.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Tasting Map</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500">Store locations will appear here once tasting addresses are added.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tasting Map</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {selectedTasting ? (
          <div className="overflow-hidden rounded-2xl border border-slate-200">
            {showFallback && !mapLoaded ? (
              <div className="flex h-[320px] flex-col items-center justify-center gap-4 bg-gradient-to-br from-slate-50 via-white to-blue-50 px-6 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                  <MapPin className="h-7 w-7" />
                </div>
                <div className="space-y-2">
                  <p className="text-base font-semibold text-slate-900">Map preview unavailable</p>
                  <p className="mx-auto max-w-md text-sm text-slate-500">
                    The live embed did not load here, but directions are ready for this tasting location.
                  </p>
                  <p className="text-sm font-medium text-slate-700">{selectedAddress}</p>
                </div>
                <a href={buildDirectionsHref(selectedAddress)} target="_blank" rel="noreferrer">
                  <Button className="gap-2">
                    <Navigation className="h-4 w-4" />
                    Open in Google Maps
                  </Button>
                </a>
              </div>
            ) : (
              <div className="relative h-[320px] w-full bg-slate-50">
                {!mapLoaded ? (
                  <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-slate-100 via-white to-blue-50" />
                ) : null}
                <iframe
                  title={`${selectedTasting.eventName} map`}
                  src={buildEmbedHref(selectedAddress)}
                  className={`h-[320px] w-full border-0 ${mapLoaded ? 'opacity-100' : 'opacity-0'}`}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  onLoad={() => {
                    setMapLoaded(true)
                    setShowFallback(false)
                  }}
                />
              </div>
            )}
          </div>
        ) : null}

        {selectedTasting ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-slate-900">{selectedTasting.eventName}</p>
                  <Badge variant={statusVariant[selectedTasting.status] ?? 'secondary'}>{selectedTasting.status}</Badge>
                </div>
                <p className="text-sm text-slate-500">
                  {formatEasternDate(selectedTasting.scheduledAt)} • {formatEasternTimeRange(selectedTasting.scheduledAt, selectedTasting.endAt)}
                </p>
              </div>
              <a href={buildDirectionsHref(selectedAddress)} target="_blank" rel="noreferrer">
                <Button className="gap-2">
                  <Navigation className="h-4 w-4" />
                  Get Directions
                </Button>
              </a>
            </div>
            <div className="mt-3 grid gap-3 text-sm text-slate-600 md:grid-cols-2">
              <p className="flex items-start gap-2">
                <Store className="mt-0.5 h-4 w-4 text-slate-400" />
                <span>{selectedAddress}</span>
              </p>
              <p className="flex items-start gap-2">
                <Phone className="mt-0.5 h-4 w-4 text-slate-400" />
                <span>{selectedTasting.storePhone ?? 'No store phone on file'}</span>
              </p>
            </div>
          </div>
        ) : null}

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {mappableTastings.map((tasting) => {
            const address = buildAddress(tasting)
            const selected = selectedTasting?.id === tasting.id
            return (
              <button
                key={tasting.id}
                type="button"
                onClick={() => setSelectedId(tasting.id)}
                className={`rounded-2xl border p-4 text-left transition ${selected ? 'border-blue-500 bg-blue-50 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-slate-900">{tasting.eventName}</p>
                  <MapPinned className="h-4 w-4 text-slate-400" />
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  {formatEasternDate(tasting.scheduledAt)} • {formatEasternTimeRange(tasting.scheduledAt, tasting.endAt)}
                </p>
                <p className="mt-3 text-sm text-slate-600">{address}</p>
                <div className="mt-4">
                  <span className="text-sm font-medium text-blue-600">View on map</span>
                </div>
              </button>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
