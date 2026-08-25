/** Presentation helpers shared by server and client components. No DB imports. */

import type { AccountTemperature, InventoryConfidence, RecommendedAction } from './types'

export const TEMPERATURE_META: Record<
  AccountTemperature,
  { label: string; emoji: string; chip: string; dot: string; order: number }
> = {
  hot: { label: 'HOT', emoji: '🔥', chip: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500', order: 0 },
  warm: { label: 'WARM', emoji: '🌤', chip: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500', order: 1 },
  cold: { label: 'COLD', emoji: '❄️', chip: 'bg-sky-50 text-sky-700 border-sky-200', dot: 'bg-sky-500', order: 2 },
  at_risk: { label: 'AT RISK', emoji: '⚠️', chip: 'bg-rose-100 text-rose-800 border-rose-300', dot: 'bg-rose-600', order: 3 },
  new: { label: 'NEW', emoji: '🆕', chip: 'bg-slate-100 text-slate-700 border-slate-200', dot: 'bg-slate-400', order: 4 },
}

export const INVENTORY_META: Record<InventoryConfidence, { label: string; chip: string }> = {
  confirmed: { label: 'Confirmed', chip: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  estimated: { label: 'Estimated', chip: 'bg-amber-50 text-amber-700 border-amber-200' },
  unknown: { label: 'Unknown', chip: 'bg-slate-100 text-slate-500 border-slate-200' },
}

export function urgencyChip(urgency: RecommendedAction['urgency']) {
  switch (urgency) {
    case 'high':
      return 'bg-red-50 text-red-700 border-red-200'
    case 'medium':
      return 'bg-amber-50 text-amber-700 border-amber-200'
    case 'low':
      return 'bg-sky-50 text-sky-700 border-sky-200'
    default:
      return 'bg-slate-50 text-slate-600 border-slate-200'
  }
}

export function scoreTone(score: number | null) {
  if (score == null) return 'text-slate-400'
  if (score >= 75) return 'text-emerald-600'
  if (score >= 50) return 'text-amber-600'
  return 'text-red-600'
}

/** Renders a value or the honest fallback — never a manufactured number. */
export const NOT_ENOUGH_DATA = 'Not enough data'

export function orDash(value: string | number | null | undefined) {
  if (value == null || value === '') return '—'
  return String(value)
}

export function fmtDays(value: number | null | undefined) {
  if (value == null) return NOT_ENOUGH_DATA
  return `${Math.round(value)}d`
}

export function fmtBottles(value: number | null | undefined) {
  if (value == null) return NOT_ENOUGH_DATA
  return `${Math.round(value)} btl`
}

export function fmtShortDate(value: Date | string | null | undefined) {
  if (!value) return '—'
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date)
}

export function fmtDateRange(from: Date | null | undefined, to: Date | null | undefined) {
  if (!from || !to) return NOT_ENOUGH_DATA
  return `${fmtShortDate(from)}–${fmtShortDate(to)}`
}

export function relativeDays(value: Date | null | undefined, now = new Date()) {
  if (!value) return null
  return Math.floor((now.getTime() - new Date(value).getTime()) / 86_400_000)
}
