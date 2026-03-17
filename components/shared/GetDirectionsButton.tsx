'use client'

import { Navigation } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Stop = {
  address: string
  lat?: number | null
  lng?: number | null
}

function buildGoogleMapsUrl(stops: Stop[], originAddress?: string | null): string {
  const encode = (s: string) => encodeURIComponent(s)

  const points = stops.map(s =>
    s.lat && s.lng ? `${s.lat},${s.lng}` : encode(s.address)
  )

  if (points.length === 0) return 'https://maps.google.com'

  if (originAddress) {
    const origin = encode(originAddress)
    const destination = points[points.length - 1]
    const waypoints = points.slice(0, -1).join('|')
    const base = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`
    return waypoints ? `${base}&waypoints=${waypoints}` : base
  }

  // No origin — first stop is origin, last is destination, middle are waypoints
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
    ...stops.map(s => s.address),
  ]
  if (allAddresses.length === 0) return 'maps://'
  const [first, ...rest] = allAddresses
  if (rest.length === 0) return `maps://?daddr=${encode(first)}&dirflg=d`
  return `maps://?saddr=${encode(first)}&daddr=${rest.map(encode).join('+to:')}&dirflg=d`
}

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
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
  if (stops.length === 0) return null

  function handleClick() {
    const url = isIOS()
      ? buildAppleMapsUrl(stops, originAddress)
      : buildGoogleMapsUrl(stops, originAddress)
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleClick}
      className={`gap-1.5 ${className ?? ''}`}
    >
      <Navigation className="w-3.5 h-3.5" />
      Get Directions
    </Button>
  )
}
