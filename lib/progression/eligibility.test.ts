import assert from 'node:assert/strict'
import test from 'node:test'
import { computeEligibility, computeRequirementProgress } from './eligibility'
import type { RequirementRow } from './data'
import type { PerformanceSummary } from './metrics'
import type { ProgressionRequirementCompletion } from '@/db/schema'

function req(overrides: Partial<RequirementRow>): RequirementRow {
  return {
    id: overrides.id ?? 'r1',
    level: 4,
    market: null,
    key: 'min_tastings',
    label: 'Minimum completed tastings',
    requirementType: 'required',
    targetNumeric: 20,
    isQualitative: false,
    notes: null,
    sortOrder: 0,
    ...overrides,
  }
}

const BASE_PERF: PerformanceSummary = {
  tastingsCompleted: 0,
  tastingHours: null,
  tastingBottlesSold: 0,
  tastingCasesSold: 0,
  repAttributedBottles: 0,
  repAttributedCases: 0,
  bottlesSold: 0,
  casesSold: 0,
  avgBottlesPerTasting: null,
  avgCasesPerActivation: null,
  accountsOpened: 0,
  reordersInfluenced: 0,
  trainingSessionsCompleted: 0,
  teamMembersTrained: 0,
  reportingCompletionPct: null,
  reliabilityPct: null,
  lastActivityAt: null,
}

function completion(overrides: Partial<ProgressionRequirementCompletion>): ProgressionRequirementCompletion {
  return {
    id: 'c1',
    userId: 'u1',
    level: 4,
    requirementKey: 'min_tastings',
    status: 'complete',
    reason: null,
    markedByUserId: 'admin-1',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  }
}

test('a computed requirement below target is in_progress, not complete', () => {
  const [progress] = computeRequirementProgress([req({ key: 'min_tastings', targetNumeric: 20 })], { ...BASE_PERF, tastingsCompleted: 5 }, null, [])
  assert.equal(progress.status, 'in_progress')
  assert.equal(progress.currentValue, 5)
})

test('a computed requirement at or above target is complete', () => {
  const [progress] = computeRequirementProgress([req({ key: 'min_tastings', targetNumeric: 20 })], { ...BASE_PERF, tastingsCompleted: 25 }, null, [])
  assert.equal(progress.status, 'complete')
})

test('zero activity is not_started, not in_progress', () => {
  const [progress] = computeRequirementProgress([req({ key: 'min_tastings', targetNumeric: 20 })], BASE_PERF, null, [])
  assert.equal(progress.status, 'not_started')
})

test('a qualitative requirement defaults to needs_manager_review with no computed value', () => {
  const [progress] = computeRequirementProgress([req({ key: 'manager_approval', isQualitative: true, targetNumeric: null })], BASE_PERF, null, [])
  assert.equal(progress.status, 'needs_manager_review')
  assert.equal(progress.currentValue, null)
})

test('a manual completion satisfies a qualitative requirement', () => {
  const [progress] = computeRequirementProgress(
    [req({ key: 'manager_approval', isQualitative: true, targetNumeric: null })],
    BASE_PERF, null,
    [completion({ requirementKey: 'manager_approval', status: 'complete' })]
  )
  assert.equal(progress.status, 'complete')
})

test('an override always wins even when the computed value would fail the target', () => {
  const [progress] = computeRequirementProgress(
    [req({ key: 'min_tastings', targetNumeric: 20 })],
    { ...BASE_PERF, tastingsCompleted: 1 }, null,
    [completion({ requirementKey: 'min_tastings', status: 'overridden', reason: 'Manager waiver — injury leave' })]
  )
  assert.equal(progress.status, 'overridden')
  assert.equal(progress.overrideReason, 'Manager waiver — injury leave')
})

test('only the latest completion row for a key is honored — an old row cannot resurrect a stale override', () => {
  const older = completion({ requirementKey: 'min_tastings', status: 'overridden', reason: 'old', createdAt: new Date('2026-01-01T00:00:00Z') })
  const newer = completion({ requirementKey: 'min_tastings', status: 'complete', reason: null, createdAt: new Date('2026-02-01T00:00:00Z') })
  const [progress] = computeRequirementProgress([req({ key: 'min_tastings', targetNumeric: 20 })], { ...BASE_PERF, tastingsCompleted: 25 }, null, [older, newer])
  assert.equal(progress.status, 'complete')
  assert.equal(progress.overrideReason, null, 'the stale override reason must not leak through once superseded')
})

test('a requirement with no configured target is treated as satisfied (nothing to check)', () => {
  const [progress] = computeRequirementProgress([req({ key: 'min_tastings', targetNumeric: null })], BASE_PERF, null, [])
  assert.equal(progress.status, 'complete')
})

test('not_applicable requirements are excluded entirely from the checklist', () => {
  const progress = computeRequirementProgress([req({ requirementType: 'not_applicable' })], BASE_PERF, null, [])
  assert.equal(progress.length, 0)
})

test('eligibility: not yet eligible until every required, measurable item is met', () => {
  const requirements = [
    req({ id: 'a', key: 'min_tastings', targetNumeric: 20 }),
    req({ id: 'b', key: 'min_bottles_sold', targetNumeric: 100 }),
  ]
  const progress = computeRequirementProgress(requirements, { ...BASE_PERF, tastingsCompleted: 20, bottlesSold: 50 }, null, [])
  const elig = computeEligibility(progress, false)
  assert.equal(elig.status, 'not_yet_eligible')
})

test('eligibility: eligible for review once measurable requirements are met, even with a qualitative one still pending', () => {
  const requirements = [
    req({ id: 'a', key: 'min_tastings', targetNumeric: 20 }),
    req({ id: 'b', key: 'manager_approval', isQualitative: true, targetNumeric: null }),
  ]
  const progress = computeRequirementProgress(requirements, { ...BASE_PERF, tastingsCompleted: 25 }, null, [])
  const elig = computeEligibility(progress, false)
  assert.equal(elig.status, 'eligible_for_review')
  assert.equal(elig.needsManagerReview, true)
})

test('eligibility: approved for promotion only once an approved recommendation is on file', () => {
  const requirements = [req({ id: 'a', key: 'min_tastings', targetNumeric: 20 })]
  const progress = computeRequirementProgress(requirements, { ...BASE_PERF, tastingsCompleted: 25 }, null, [])
  assert.equal(computeEligibility(progress, false).status, 'eligible_for_review')
  assert.equal(computeEligibility(progress, true).status, 'approved_for_promotion')
})

test('eligibility never auto-promotes: recommended-but-not-approved stays at eligible_for_review', () => {
  const requirements = [req({ id: 'a', key: 'min_tastings', targetNumeric: 20 })]
  const progress = computeRequirementProgress(requirements, { ...BASE_PERF, tastingsCompleted: 999 }, null, [])
  const elig = computeEligibility(progress, false)
  assert.notEqual(elig.status, 'approved_for_promotion')
})

test('recommended-only requirements do not block eligible_for_review even when unmet', () => {
  const requirements = [
    req({ id: 'a', key: 'min_tastings', targetNumeric: 20 }),
    req({ id: 'b', key: 'min_cases_sold', targetNumeric: 999, requirementType: 'recommended' }),
  ]
  const progress = computeRequirementProgress(requirements, { ...BASE_PERF, tastingsCompleted: 25, casesSold: 0 }, null, [])
  const elig = computeEligibility(progress, false)
  assert.equal(elig.status, 'eligible_for_review')
})
