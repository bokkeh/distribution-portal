import { createHash, randomBytes } from 'crypto'

export function createRepAssistedAccessToken() {
  const token = randomBytes(32).toString('base64url')
  return { token, hash: hashRepAssistedAccessToken(token) }
}

export function hashRepAssistedAccessToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export function getRepAssistedTokenExpiration() {
  const configuredHours = Number(process.env.REP_ASSISTED_LINK_EXPIRY_HOURS ?? '168')
  const hours = Number.isFinite(configuredHours) && configuredHours > 0 ? configuredHours : 168
  return new Date(Date.now() + hours * 60 * 60 * 1000)
}

export function getRepAssistedReviewUrl(token: string) {
  const base = process.env.NEXTAUTH_URL ?? 'https://portal.ahawc.com'
  return `${base}/order-review/${encodeURIComponent(token)}`
}
