import { type Duration, Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'

// ---------------------------------------------------------------------------
// Factory — one Redis client, multiple named limiters
// ---------------------------------------------------------------------------

function makeRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  return new Redis({ url, token })
}

let _redis: Redis | null | undefined = undefined // undefined = not yet checked

function getRedis(): Redis | null {
  if (_redis !== undefined) return _redis
  _redis = makeRedis()
  if (!_redis && process.env.NODE_ENV === 'production') {
    console.warn('[rate-limit] UPSTASH_REDIS_REST_URL / TOKEN not set — rate limiting disabled')
  }
  return _redis
}

function makeLimiter(prefix: string, requests: number, window: Duration) {
  let instance: Ratelimit | null = null
  return async function isLimited(identifier: string): Promise<boolean> {
    if (!instance) {
      const redis = getRedis()
      if (!redis) return false
      instance = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(requests, window), prefix })
    }
    const { success } = await instance.limit(identifier)
    return !success
  }
}

// ---------------------------------------------------------------------------
// Named limiters
// ---------------------------------------------------------------------------

/** Login: 5 attempts / 15 min per IP+email */
export const isLoginRateLimited = makeLimiter('login', 5, '15 m')

/** Payment intent creation: 10 / hour per user */
export const isPaymentIntentRateLimited = makeLimiter('payment-intent', 10, '1 h')

/** File upload: 30 / hour per user */
export const isUploadRateLimited = makeLimiter('upload', 30, '1 h')

/** Geocode: 60 / minute per user */
export const isGeocodeRateLimited = makeLimiter('geocode', 60, '1 m')

/** Manual geocode actions triggered inside the portal */
export const isGeocodeActionRateLimited = makeLimiter('geocode-action', 30, '1 h')

/** Batch geocoding is high-cost and should be infrequent */
export const isBatchGeocodeRateLimited = makeLimiter('geocode-batch', 3, '15 m')

/** Route optimization uses billable Directions API requests */
export const isDirectionsRateLimited = makeLimiter('directions-action', 20, '1 h')

/** Public delivery tracking token lookups: 60 / 15 min per token+viewer */
export const isDeliveryTrackingRateLimited = makeLimiter('delivery-tracking', 60, '15 m')

// ---------------------------------------------------------------------------
// Shared 429 response
// ---------------------------------------------------------------------------

export function rateLimitResponse() {
  return NextResponse.json(
    { error: 'Too many requests. Please try again later.' },
    { status: 429 },
  )
}
