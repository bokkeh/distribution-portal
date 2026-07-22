export function toBottles(cases: number, looseBottles: number, bottlesPerCase: number) {
  return Math.max(0, cases) * bottlesPerCase + Math.max(0, looseBottles)
}

export function fromBottles(totalBottles: number, bottlesPerCase: number) {
  const safeTotal = Math.max(0, totalBottles)
  return {
    cases: Math.floor(safeTotal / bottlesPerCase),
    bottles: safeTotal % bottlesPerCase,
  }
}

export function formatStock(totalBottles: number, bottlesPerCase: number) {
  const normalized = fromBottles(totalBottles, bottlesPerCase)
  const parts: string[] = []
  if (normalized.cases) parts.push(`${normalized.cases} ${normalized.cases === 1 ? 'case' : 'cases'}`)
  if (normalized.bottles || parts.length === 0) parts.push(`${normalized.bottles} ${normalized.bottles === 1 ? 'bottle' : 'bottles'}`)
  return parts.join(' + ')
}
