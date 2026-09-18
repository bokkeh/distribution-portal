// Adjacent tastings are allowed; missing legacy end times keep the existing two-hour fallback.
export function tastingWindowsOverlap(startA: Date, endA: Date, startB: Date, endB: Date) {
  return startA < endB && startB < endA
}

export function getTastingAvailabilityMonthRange(dateKey: string) {
  const [year, month] = dateKey.split('-').map(Number)
  return {
    monthStart: `${dateKey.slice(0, 7)}-01`,
    monthEnd: new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10),
  }
}
