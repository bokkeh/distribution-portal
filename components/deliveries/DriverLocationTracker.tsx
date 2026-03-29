'use client'

import { useEffect } from 'react'
import { updateDriverLocation } from '@/actions/deliveries'

export function DriverLocationTracker({
  stopId,
  enabled,
}: {
  stopId: string
  enabled: boolean
}) {
  useEffect(() => {
    if (!enabled || typeof navigator === 'undefined' || !navigator.geolocation) return

    let lastSentAt = 0
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const now = Date.now()
        if (now - lastSentAt < 20000) return
        lastSentAt = now
        void updateDriverLocation({
          stopId,
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        })
      },
      () => {},
      {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 15000,
      },
    )

    return () => navigator.geolocation.clearWatch(watchId)
  }, [enabled, stopId])

  return null
}
