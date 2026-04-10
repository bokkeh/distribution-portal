import { db } from '@/db'
import { geocodeCache } from '@/db/schema'
import { eq } from 'drizzle-orm'

const FAILED_CACHE_RETRY_MS = 60 * 60 * 1000

function normalizeAddress(address: string) {
  return address
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

export async function geocodeAddress(
  address: string,
  options?: { forceRefresh?: boolean; retryFailedAfterMs?: number },
): Promise<{ lat: number; lng: number } | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  const trimmedAddress = address?.trim()
  if (!apiKey || !trimmedAddress) return null

  const normalizedAddress = normalizeAddress(trimmedAddress)
  const retryFailedAfterMs = options?.retryFailedAfterMs ?? FAILED_CACHE_RETRY_MS

  const [cached] = await db
    .select({
      lat: geocodeCache.lat,
      lng: geocodeCache.lng,
      status: geocodeCache.status,
      updatedAt: geocodeCache.updatedAt,
    })
    .from(geocodeCache)
    .where(eq(geocodeCache.normalizedAddress, normalizedAddress))
    .limit(1)

  if (cached && !options?.forceRefresh) {
    if (cached.status === 'ok' && typeof cached.lat === 'number' && typeof cached.lng === 'number') {
      return { lat: cached.lat, lng: cached.lng }
    }

    if (cached.status === 'failed') {
      const updatedAt = cached.updatedAt ? new Date(cached.updatedAt).getTime() : 0
      if ((Date.now() - updatedAt) < retryFailedAfterMs) {
        return null
      }
    }
  }

  try {
    const encoded = encodeURIComponent(trimmedAddress)
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encoded}&key=${apiKey}`
    )
    const data = await res.json()

    if (data.status !== 'OK' || !data.results?.[0]) {
      await db
        .insert(geocodeCache)
        .values({
          normalizedAddress,
          originalAddress: trimmedAddress,
          lat: null,
          lng: null,
          status: 'failed',
        })
        .onConflictDoUpdate({
          target: geocodeCache.normalizedAddress,
          set: {
            originalAddress: trimmedAddress,
            lat: null,
            lng: null,
            status: 'failed',
            updatedAt: new Date(),
          },
        })

      return null
    }

    const { lat, lng } = data.results[0].geometry.location

    await db
      .insert(geocodeCache)
      .values({
        normalizedAddress,
        originalAddress: trimmedAddress,
        lat,
        lng,
        status: 'ok',
      })
      .onConflictDoUpdate({
        target: geocodeCache.normalizedAddress,
        set: {
          originalAddress: trimmedAddress,
          lat,
          lng,
          status: 'ok',
          updatedAt: new Date(),
        },
      })

    return { lat, lng }
  } catch {
    return null
  }
}
