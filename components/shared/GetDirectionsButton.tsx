'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown, ExternalLink, Navigation } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Stop = {
  address: string
  lat?: number | null
  lng?: number | null
}

function buildGoogleMapsUrl(stops: Stop[], originAddress?: string | null): string {
  const encode = (s: string) => encodeURIComponent(s)

  const points = stops.map((stop) =>
    stop.lat && stop.lng ? `${stop.lat},${stop.lng}` : encode(stop.address),
  )

  if (points.length === 0) return 'https://maps.google.com'

  if (originAddress) {
    const origin = encode(originAddress)
    const destination = points[points.length - 1]
    const waypoints = points.slice(0, -1).join('|')
    const base = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`
    return waypoints ? `${base}&waypoints=${waypoints}` : base
  }

  const origin = points[0]
  const destination = points[points.length - 1]
  const waypoints = points.slice(1, -1).join('|')
  const base = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`
  return waypoints ? `${base}&waypoints=${waypoints}` : base
}

function buildAppleMapsUrl(stops: Stop[], originAddress?: string | null): string {
  const encode = (s: string) => encodeURIComponent(s)
  const allAddresses = [
    ...(originAddress ? [originAddress] : []),
    ...stops.map((stop) => stop.address),
  ]

  if (allAddresses.length === 0) return 'maps://'

  const [first, ...rest] = allAddresses
  if (rest.length === 0) return `maps://?daddr=${encode(first)}&dirflg=d`
  return `maps://?saddr=${encode(first)}&daddr=${rest.map(encode).join('+to:')}&dirflg=d`
}

function openMaps(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer')
}

export default function GetDirectionsButton({
  stops,
  originAddress,
  className,
}: {
  stops: Stop[]
  originAddress?: string | null
  className?: string
}) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  if (stops.length === 0) return null

  const googleMapsUrl = buildGoogleMapsUrl(stops, originAddress)
  const appleMapsUrl = buildAppleMapsUrl(stops, originAddress)

  function handleSelect(url: string) {
    setIsOpen(false)
    openMaps(url)
  }

  return (
    <div ref={menuRef} className={`relative inline-flex ${className ?? ''}`}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setIsOpen((open) => !open)}
        className="gap-1.5"
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        <Navigation className="h-3.5 w-3.5" />
        Get Directions
        <ChevronDown className="h-3.5 w-3.5" />
      </Button>

      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
          <button
            type="button"
            onClick={() => handleSelect(googleMapsUrl)}
            className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50"
            role="menuitem"
          >
            <span>
              <span className="block font-medium text-slate-900">Open in Google Maps</span>
              <span className="block text-xs text-slate-500">Desktop and mobile</span>
            </span>
            <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
          </button>
          <button
            type="button"
            onClick={() => handleSelect(appleMapsUrl)}
            className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50"
            role="menuitem"
          >
            <span>
              <span className="block font-medium text-slate-900">Open in Apple Maps</span>
              <span className="block text-xs text-slate-500">Best for iPhone and Mac</span>
            </span>
            <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
          </button>
        </div>
      )}
    </div>
  )
}
