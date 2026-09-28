export const CANCELLATION_REASON_OPTIONS = [
  { value: 'sick_emergency', label: 'Sick / Emergency' },
  { value: 'schedule_conflict', label: 'Schedule Conflict' },
  { value: 'venue_cancelled', label: 'Venue Cancelled' },
  { value: 'weather', label: 'Weather' },
  { value: 'transportation', label: 'Transportation' },
  { value: 'no_longer_available', label: 'No Longer Available' },
  { value: 'other', label: 'Other' },
] as const

export type CancellationReason = (typeof CANCELLATION_REASON_OPTIONS)[number]['value']

export const CANCELLATION_REASON_LABELS: Record<string, string> = Object.fromEntries(
  CANCELLATION_REASON_OPTIONS.map((option) => [option.value, option.label]),
)

/** A cancelled tasting needs a new taster unless the venue itself called off the event. */
export function tastingNeedsCoverage(status: string, cancellationReason: string | null | undefined): boolean {
  return status === 'cancelled' && cancellationReason !== 'venue_cancelled'
}
