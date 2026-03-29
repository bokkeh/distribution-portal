'use client'

import { useEffect } from 'react'
import { updateDriverLocation } from '@/actions/deliveries'

export type DriverGpsState = {
  status: 'inactive' | 'sharing' | 'permission_needed' | 'unsupported' | 'error'
  lastSentAt: number | null
  message?: string
}

export function DriverLocationTracker({
  stopId,
  enabled,
  onStateChange,
}: {
  stopId: string
  enabled: boolean
  onStateChange?: (state: DriverGpsState) => void
}) {
  useEffect(() => {
    if (!enabled) {
      onStateChange?.({ status: 'inactive', lastSentAt: null })
      return
    }

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      onStateChange?.({ status: 'unsupported', lastSentAt: null, message: 'Location sharing is not supported on this device.' })
      return
    }

    let lastSentAt = 0
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const now = Date.now()
        if (now - lastSentAt < 20000) return
        void updateDriverLocation({
          stopId,
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        })
          .then(() => {
            lastSentAt = now
            onStateChange?.({ status: 'sharing', lastSentAt: now })
          })
          .catch((error) => {
            onStateChange?.({
              status: 'error',
              lastSentAt,
              message: error instanceof Error ? error.message : 'Unable to send your location update.',
            })
          })
      },
      (error) => {
        const nextState: DriverGpsState =
          error.code === error.PERMISSION_DENIED
            ? { status: 'permission_needed', lastSentAt, message: 'Allow location access to keep the customer ETA live.' }
            : { status: 'error', lastSentAt, message: 'Location updates paused. Move to a stronger signal and try again.' }

        onStateChange?.(nextState)
      },
      {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 15000,
      },
    )

    return () => {
      navigator.geolocation.clearWatch(watchId)
    }
  }, [enabled, onStateChange, stopId])

  return null
}
