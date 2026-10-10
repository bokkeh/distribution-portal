import { fieldLoginReturn } from '@/lib/field/validation'

export const FIELD_DEVICE_COOKIE = 'ahawc_field_device'
export const FIELD_SESSION_MAX_AGE = 30 * 24 * 60 * 60
export const DEFAULT_SESSION_MAX_AGE = 4 * 60 * 60
export const FIELD_ACCOUNT_REFRESH_MS = 5 * 60 * 1000

export function isFieldEntry(pathname: string, next: string | null) {
  return pathname === '/field' || (pathname === '/login' && fieldLoginReturn(next) !== null)
}

export function requiresPublicAgeGate(pathname: string, next: string | null) {
  return ['/', '/login', '/privacy', '/terms'].includes(pathname) && !isFieldEntry(pathname, next)
}
