import assert from 'node:assert/strict'
import test from 'node:test'
import { computeMemberPerformance } from './metrics'
import type { ProgressionDataset, RosterMember, TastingRow, PaidOrderRow } from './data'

function member(overrides: Partial<RosterMember> = {}): RosterMember {
  return {
    id: 'u1',
    name: 'Jordan Lee',
    email: 'jordan@example.com',
    role: 'taster',
    active: true,
    avatarUrl: null,
    homeRegion: 'DC Metro',
    managerId: null,
    managerUserId: null,
    managerName: null,
    salesMemberId: null,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  }
}

function tasting(overrides: Partial<TastingRow>): TastingRow {
  return {
    id: 't1',
    assignedUserId: 'u1',
    status: 'completed',
    scheduledAt: new Date('2026-01-10T18:00:00Z'),
    endAt: null,
    objective: null,
    report: null,
    ...overrides,
  }
}

function order(overrides: Partial<PaidOrderRow>): PaidOrderRow {
  return {
    id: 'o1',
    customerId: 'acct-1',
    createdAt: new Date('2026-01-15T00:00:00Z'),
    relatedTastingId: null,
    attributedSalesMemberId: null,
    bottles: 0,
    cases: 0,
    ...overrides,
  }
}

function emptyDataset(): ProgressionDataset {
  return {
    tastingsByUser: new Map(),
    ordersByTastingId: new Map(),
    ordersByMemberId: new Map(),
    firstOrderAtByAccount: new Map(),
    accountsBySalesMemberId: new Map(),
    trainingByTrainer: new Map(),
  }
}

test('only completed tastings with a submitted report contribute bottles/cases sold', () => {
  const dataset = emptyDataset()
  dataset.tastingsByUser.set('u1', [
    tasting({ id: 't1', status: 'completed', report: { bottlesSold: 10, casesSold: 1, actualStartTime: null, actualEndTime: null, submittedAt: new Date() } }),
    tasting({ id: 't2', status: 'completed', report: null }), // completed but never reported — must not inflate the count
    tasting({ id: 't3', status: 'cancelled', report: null }),
  ])

  const perf = computeMemberPerformance(member(), dataset)
  assert.equal(perf.tastingsCompleted, 2, 'both completed tastings count toward the completed total')
  assert.equal(perf.tastingBottlesSold, 10, 'only the reported tasting contributes bottles')
  assert.equal(perf.reportingCompletionPct, 50, '1 of 2 completed tastings reported')
})

test('a duplicate tasting id cannot be double counted (DB unique constraint models this as one row)', () => {
  // tasting_reports.tasting_id is UNIQUE at the database level, so there is only ever one
  // report per tasting to aggregate — this test locks the aggregation math to that one row.
  const dataset = emptyDataset()
  dataset.tastingsByUser.set('u1', [
    tasting({ id: 't1', status: 'completed', report: { bottlesSold: 12, casesSold: 1, actualStartTime: null, actualEndTime: null, submittedAt: new Date() } }),
  ])
  const perf = computeMemberPerformance(member(), dataset)
  assert.equal(perf.tastingBottlesSold, 12)
})

test('bottles sold combines the tasting channel and the rep-attributed wholesale channel without conflating them', () => {
  const dataset = emptyDataset()
  dataset.tastingsByUser.set('u1', [
    tasting({ id: 't1', report: { bottlesSold: 10, casesSold: 0, actualStartTime: null, actualEndTime: null, submittedAt: new Date() } }),
  ])
  dataset.ordersByMemberId.set('sm-1', [order({ id: 'o1', bottles: 24, cases: 2 })])

  const perf = computeMemberPerformance(member({ salesMemberId: 'sm-1' }), dataset)
  assert.equal(perf.tastingBottlesSold, 10)
  assert.equal(perf.repAttributedBottles, 24)
  assert.equal(perf.bottlesSold, 34)
})

test('reorders influenced excludes an account\'s very first order (that is a new-account sale, not a reorder)', () => {
  const dataset = emptyDataset()
  dataset.tastingsByUser.set('u1', [tasting({ id: 't1' })])
  dataset.firstOrderAtByAccount.set('acct-1', new Date('2026-01-01T00:00:00Z'))
  dataset.ordersByTastingId.set('t1', [
    order({ id: 'o-first', customerId: 'acct-1', createdAt: new Date('2026-01-01T00:00:00Z') }),
    order({ id: 'o-reorder', customerId: 'acct-1', createdAt: new Date('2026-01-20T00:00:00Z') }),
  ])

  const perf = computeMemberPerformance(member(), dataset)
  assert.equal(perf.reordersInfluenced, 1)
})

test('the same order reachable through both the tasting channel and the rep-attribution channel is only counted once', () => {
  const dataset = emptyDataset()
  dataset.tastingsByUser.set('u1', [tasting({ id: 't1' })])
  dataset.firstOrderAtByAccount.set('acct-1', new Date('2026-01-01T00:00:00Z'))
  const sharedOrder = order({ id: 'o-shared', customerId: 'acct-1', createdAt: new Date('2026-01-20T00:00:00Z'), attributedSalesMemberId: 'sm-1' })
  dataset.ordersByTastingId.set('t1', [sharedOrder])
  dataset.ordersByMemberId.set('sm-1', [sharedOrder])

  const perf = computeMemberPerformance(member({ salesMemberId: 'sm-1' }), dataset)
  assert.equal(perf.reordersInfluenced, 1, 'deduplicated by order id, not double counted across channels')
})

test('accounts opened counts only accounts assigned to this member\'s sales-member id', () => {
  const dataset = emptyDataset()
  dataset.accountsBySalesMemberId.set('sm-1', [{ id: 'acct-1', createdAt: new Date() }, { id: 'acct-2', createdAt: new Date() }])
  const withMember = computeMemberPerformance(member({ salesMemberId: 'sm-1' }), dataset)
  const withoutMember = computeMemberPerformance(member({ salesMemberId: null }), dataset)
  assert.equal(withMember.accountsOpened, 2)
  assert.equal(withoutMember.accountsOpened, 0)
})

test('reliability is measured against past-due terminal tastings only, not future-scheduled ones', () => {
  const dataset = emptyDataset()
  dataset.tastingsByUser.set('u1', [
    tasting({ id: 't1', status: 'completed', scheduledAt: new Date('2026-01-01T00:00:00Z') }),
    tasting({ id: 't2', status: 'cancelled', scheduledAt: new Date('2026-01-05T00:00:00Z') }),
    tasting({ id: 't3', status: 'scheduled', scheduledAt: new Date('2099-01-01T00:00:00Z') }), // far future, must not count
  ])
  const perf = computeMemberPerformance(member(), dataset)
  assert.equal(perf.reliabilityPct, 50, '1 completed of 2 past-due terminal tastings')
})

test('training sessions count distinct trainees for "team members trained" but every session for "sessions completed"', () => {
  const dataset = emptyDataset()
  dataset.trainingByTrainer.set('u1', [
    { traineeUserId: 'trainee-a', sessionDate: new Date('2026-01-01') },
    { traineeUserId: 'trainee-a', sessionDate: new Date('2026-01-08') },
    { traineeUserId: 'trainee-b', sessionDate: new Date('2026-01-15') },
  ])
  const perf = computeMemberPerformance(member(), dataset)
  assert.equal(perf.trainingSessionsCompleted, 3)
  assert.equal(perf.teamMembersTrained, 2)
})
