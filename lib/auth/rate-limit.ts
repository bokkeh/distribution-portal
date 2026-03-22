import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// Lazily initialised — only created if env vars are present.
let _limiter: Ratelimit | null = null

function getLimiter(): Ratelimit | null {
  if (_limiter) return _limiter
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  _limiter = new Ratelimit({
    redis: new Redis({ url, token }),
    // 5 attempts per 15-minute sliding window per identifier
    limiter: Ratelimit.slidingWindow(5, '15 m'),
    prefix: 'login',
  })
  return _limiter
}

/**
 * Returns true if the request should be blocked.
 * Silently allows through if Upstash is not configured.
 */
export async function isLoginRateLimited(identifier: string): Promise<boolean> {
  const limiter = getLimiter()
  if (!limiter) {
    if (process.env.NODE_ENV === 'production') {
      console.warn('[rate-limit] UPSTASH_REDIS_REST_URL / TOKEN not set — login rate limiting disabled')
    }
    return false
  }
  const { success } = await limiter.limit(identifier)
  return !success
}
