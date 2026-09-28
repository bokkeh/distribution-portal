import type { ProgressionDataset, RosterMember } from './data'

export type PerformanceSummary = {
  tastingsCompleted: number
  tastingHours: number | null
  tastingBottlesSold: number
  tastingCasesSold: number
  repAttributedBottles: number
  repAttributedCases: number
  bottlesSold: number
  casesSold: number
  avgBottlesPerTasting: number | null
  avgCasesPerActivation: number | null
  accountsOpened: number
  reordersInfluenced: number
  trainingSessionsCompleted: number
  teamMembersTrained: number
  reportingCompletionPct: number | null
  reliabilityPct: number | null
  lastActivityAt: Date | null
}

function parseHours(start: string | null, end: string | null): number | null {
  if (!start || !end) return null
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  if ([sh, sm, eh, em].some(n => Number.isNaN(n))) return null
  let minutes = (eh * 60 + em) - (sh * 60 + sm)
  if (minutes < 0) minutes += 24 * 60
  return minutes / 60
}

const TERMINAL_STATUSES = new Set(['completed', 'cancelled', 'declined'])

export function computeMemberPerformance(member: RosterMember, dataset: ProgressionDataset): PerformanceSummary {
  const now = new Date()
  const tastings = dataset.tastingsByUser.get(member.id) ?? []
  const completed = tastings.filter(t => t.status === 'completed')
  const reported = completed.filter(t => t.report)
  const pastDueTerminal = tastings.filter(t => TERMINAL_STATUSES.has(t.status) && t.scheduledAt <= now)

  const tastingBottlesSold = reported.reduce((sum, t) => sum + (t.report?.bottlesSold ?? 0), 0)
  const tastingCasesSold = reported.reduce((sum, t) => sum + (t.report?.casesSold ?? 0), 0)
  const tastingHoursTotal = reported.reduce((sum, t) => {
    const h = parseHours(t.report?.actualStartTime ?? null, t.report?.actualEndTime ?? null)
    return h != null ? sum + h : sum
  }, 0)
  const hoursCount = reported.filter(t => parseHours(t.report?.actualStartTime ?? null, t.report?.actualEndTime ?? null) != null).length

  const memberId = member.salesMemberId
  const repOrders = memberId ? dataset.ordersByMemberId.get(memberId) ?? [] : []
  const repAttributedBottles = repOrders.reduce((sum, o) => sum + o.bottles, 0)
  const repAttributedCases = repOrders.reduce((sum, o) => sum + o.cases, 0)

  const ordersFromTastings = tastings.flatMap(t => dataset.ordersByTastingId.get(t.id) ?? [])
  const candidateOrders = new Map<string, { id: string; customerId: string; createdAt: Date }>()
  for (const o of [...ordersFromTastings, ...repOrders]) candidateOrders.set(o.id, o)
  let reordersInfluenced = 0
  for (const o of candidateOrders.values()) {
    const firstAt = dataset.firstOrderAtByAccount.get(o.customerId)
    if (firstAt && o.createdAt.getTime() > firstAt.getTime()) reordersInfluenced += 1
  }

  const accountsOpened = memberId ? (dataset.accountsBySalesMemberId.get(memberId) ?? []).length : 0

  const training = dataset.trainingByTrainer.get(member.id) ?? []
  const trainingSessionsCompleted = training.length
  const teamMembersTrained = new Set(training.map(t => t.traineeUserId)).size

  const lastActivityCandidates: Date[] = [
    ...tastings.map(t => t.report?.submittedAt ?? t.scheduledAt),
    ...ordersFromTastings.map(o => o.createdAt),
    ...repOrders.map(o => o.createdAt),
    ...training.map(t => t.sessionDate),
  ]
  const lastActivityAt = lastActivityCandidates.length ? new Date(Math.max(...lastActivityCandidates.map(d => d.getTime()))) : null

  return {
    tastingsCompleted: completed.length,
    tastingHours: hoursCount > 0 ? Math.round((tastingHoursTotal / hoursCount) * 10) / 10 : null,
    tastingBottlesSold,
    tastingCasesSold,
    repAttributedBottles,
    repAttributedCases,
    bottlesSold: tastingBottlesSold + repAttributedBottles,
    casesSold: tastingCasesSold + repAttributedCases,
    avgBottlesPerTasting: reported.length > 0 ? Math.round((tastingBottlesSold / reported.length) * 10) / 10 : null,
    avgCasesPerActivation: reported.length > 0 ? Math.round((tastingCasesSold / reported.length) * 100) / 100 : null,
    accountsOpened,
    reordersInfluenced,
    trainingSessionsCompleted,
    teamMembersTrained,
    reportingCompletionPct: completed.length > 0 ? Math.round((reported.length / completed.length) * 1000) / 10 : null,
    reliabilityPct: pastDueTerminal.length > 0 ? Math.round((completed.filter(t => pastDueTerminal.includes(t)).length / pastDueTerminal.length) * 1000) / 10 : null,
    lastActivityAt,
  }
}

export function performanceValueForKey(key: string, perf: PerformanceSummary, daysAtCurrentLevel: number | null): number | null {
  switch (key) {
    case 'min_tastings': return perf.tastingsCompleted
    case 'min_bottles_sold': return perf.bottlesSold
    case 'min_cases_sold': return perf.casesSold
    case 'min_avg_bottles_per_tasting': return perf.avgBottlesPerTasting
    case 'min_accounts_opened': return perf.accountsOpened
    case 'min_reorders_influenced': return perf.reordersInfluenced
    case 'min_team_members_trained': return perf.teamMembersTrained
    case 'min_time_at_previous_level_days': return daysAtCurrentLevel
    case 'reporting_completion_pct': return perf.reportingCompletionPct
    case 'reliability_pct': return perf.reliabilityPct
    default: return null
  }
}
