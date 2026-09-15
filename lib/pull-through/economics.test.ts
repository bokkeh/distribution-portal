import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DEFAULT_ECONOMICS_SETTINGS,
  buildTastingDecision,
  classifyAccountHealth,
  classifyOrderAttribution,
  computeAccountEconomics,
  computeAccountVelocity,
  computeTastingDependency,
  computeTastingEconomics,
  resolveTastingCost,
} from './economics'
import { attachTastingOrderAttribution, computeInventoryPosition, computeOrderMetrics, computeTastingMetrics } from './metrics'
import type { PullThroughOrder, PullThroughTasting } from './types'

const NOW = new Date('2026-09-14T12:00:00Z')
const day = (iso: string) => new Date(`${iso}T12:00:00Z`)
const settings = DEFAULT_ECONOMICS_SETTINGS

function order(date: string, index: number, cases = 1): PullThroughOrder {
  return {
    id: `o-${date}`,
    accountId: 'a1',
    orderedAt: day(date),
    orderType: 'paid',
    status: 'fulfilled',
    cases,
    bottles: cases * 12,
    total: cases * 240,
    sequenceIndex: index,
    isReorder: index > 0,
    attribution: null,
  }
}

function tasting(date: string, bottlesSold: number | null, extra: Partial<PullThroughTasting> = {}): PullThroughTasting {
  return {
    id: `t-${date}`,
    accountId: 'a1',
    eventName: 'Tasting',
    occurredAt: day(date),
    status: 'completed',
    tasterUserId: 'u1',
    tasterName: 'Taster',
    hasReport: bottlesSold != null,
    reportSubmittedByName: null,
    startTime: null,
    endTime: null,
    bottlesSold,
    casesSold: null,
    samplesServed: null,
    consumerInteractions: null,
    bottlesInStockBefore: null,
    bottlesInStockAfter: null,
    accountFeedback: null,
    highlights: null,
    issues: null,
    followUpNeeded: false,
    followUpNotes: null,
    photoUrls: [],
    nextOrderId: null,
    nextOrderAt: null,
    nextOrderBottles: null,
    nextOrderCases: null,
    daysToNextOrder: null,
    within7: false,
    within14: false,
    within30: false,
    objective: null,
    primaryGoal: null,
    targetBottlesSold: null,
    targetCasesDepleted: null,
    targetReorderQuantity: null,
    cost: 90,
    costSource: 'default',
    economics: null,
    ...extra,
  }
}

const unknownInventory = computeInventoryPosition(null, 0, null, 12, NOW)

/** The spec's own example: Order → Tasting → Reorder → Tasting → Reorder. */
function subsidizedAccount() {
  const orders = [order('2026-05-01', 0), order('2026-05-20', 1), order('2026-06-22', 2)]
  const tastings = [tasting('2026-05-12', 7), tasting('2026-06-15', 8)]
  return { orders, tastings }
}

test('cost precedence is invoice, then estimate, then the global default', () => {
  assert.deepEqual(resolveTastingCost({ invoiceTotal: 120, estimatedCost: 80 }, settings), { cost: 120, costSource: 'invoice' })
  assert.deepEqual(resolveTastingCost({ invoiceTotal: null, estimatedCost: 80 }, settings), { cost: 80, costSource: 'estimate' })
  assert.deepEqual(resolveTastingCost({ invoiceTotal: 0, estimatedCost: null }, settings), { cost: 90, costSource: 'default' })
})

test('a reorder shortly after a tasting is assisted; the initial order is organic', () => {
  const { orders, tastings } = subsidizedAccount()
  const classified = classifyOrderAttribution(orders, tastings, settings)
  assert.equal(classified[0].attribution?.kind, 'organic')
  assert.equal(classified[1].attribution?.kind, 'assisted')
  assert.equal(classified[1].attribution?.tastingId, 't-2026-05-12')
  assert.equal(classified[1].attribution?.daysSinceTasting, 8)
  assert.equal(classified[2].attribution?.kind, 'assisted')
})

test('a reorder well after a tasting with real stock movement in between is organic', () => {
  const orders = [order('2026-05-01', 0), order('2026-07-15', 1)]
  const tastings = [tasting('2026-05-12', 3)]
  const [, reorder] = classifyOrderAttribution(orders, tastings, settings)
  assert.equal(reorder.attribution?.kind, 'organic')
  assert.equal(reorder.attribution?.bottlesMovedOutsideTasting, 9)
})

test('a big tasting sale keeps a later reorder assisted, up to 45 days', () => {
  const orders = [order('2026-05-01', 0), order('2026-06-10', 1)]
  const tastings = [tasting('2026-05-12', 8)] // 8 of 12 bottles, 29 days before reorder
  const [, reorder] = classifyOrderAttribution(orders, tastings, settings)
  assert.equal(reorder.attribution?.kind, 'assisted')
})

test('an admin override wins over the automatic classification', () => {
  const { orders, tastings } = subsidizedAccount()
  const overrides = new Map([['o-2026-05-20', { kind: 'organic' as const, reason: 'Store ran a promo' }]])
  const classified = classifyOrderAttribution(orders, tastings, settings, overrides)
  assert.equal(classified[1].attribution?.kind, 'organic')
  assert.equal(classified[1].attribution?.source, 'override')
})

test('tasting economics: immediate net is negative, windows show later organic lift', () => {
  const orders = [order('2026-05-01', 0), order('2026-05-20', 1), order('2026-06-20', 2), order('2026-07-05', 3, 2)]
  const tastings = [tasting('2026-05-12', 7)]
  const classified = classifyOrderAttribution(orders, tastings, settings)
  const econ = computeTastingEconomics(tastings[0], classified, settings)

  assert.equal(econ.attributedCases, 1)
  assert.equal(econ.contribution, 75)
  assert.equal(econ.net, -15)
  assert.equal(econ.roiPercent, -17)

  const w60 = econ.windows.find((w) => w.days === 60)!
  assert.equal(w60.cases, 4) // 1 assisted + 1 + 2 organic
  assert.equal(w60.organicCases, 3)
  assert.equal(w60.contribution, 300)
  assert.equal(w60.net, 210)
})

test('dependency and health flag the subsidized pattern and require acknowledgement', () => {
  const { orders, tastings } = subsidizedAccount()
  const classified = classifyOrderAttribution(orders, tastings, settings)
  const attributed = attachTastingOrderAttribution(tastings, classified)
  const orderMetrics = computeOrderMetrics(classified, 0, NOW)
  const tastingMetrics = computeTastingMetrics(attributed, classified)
  const velocity = computeAccountVelocity(orderMetrics, classified, attributed, settings)
  const economics = computeAccountEconomics(classified, attributed, velocity, settings, NOW)
  const dependency = computeTastingDependency(classified, attributed, velocity, economics)

  assert.equal(velocity.totalCases, 3)
  assert.equal(velocity.assistedCases, 2)
  assert.equal(velocity.organicCases, 1)
  assert.equal(velocity.assistedPercent, 66.7)
  assert.equal(economics.contribution, 225)
  assert.equal(economics.tastingSpend, 180)
  assert.equal(economics.netContribution, 45)

  assert.equal(dependency.status, 'tasting_dependent')
  assert.ok(dependency.flags.some((flag) => flag.key === 'tasting_before_reorders'))
  assert.match(dependency.patternWarning ?? '', /before each of its last 2 reorders/)

  const health = classifyAccountHealth(orderMetrics, velocity, dependency, economics, unknownInventory, tastingMetrics, 200)
  assert.equal(health.kind, 'tasting_dependent')

  const decision = buildTastingDecision({
    orders: orderMetrics,
    inventory: unknownInventory,
    tastings: attributed,
    velocity,
    dependency,
    economics,
    health,
    settings,
    now: NOW,
  })
  assert.equal(decision.kind, 'consider')
})

test('three cases and three tastings is an unprofitable support cycle', () => {
  const orders = [order('2026-04-01', 0), order('2026-05-01', 1), order('2026-06-01', 2)]
  const tastings = [tasting('2026-03-25', 6), tasting('2026-04-24', 6), tasting('2026-05-25', 6)]
  const classified = classifyOrderAttribution(orders, tastings, settings)
  const attributed = attachTastingOrderAttribution(tastings, classified)
  const orderMetrics = computeOrderMetrics(classified, 0, NOW)
  const tastingMetrics = computeTastingMetrics(attributed, classified)
  const velocity = computeAccountVelocity(orderMetrics, classified, attributed, settings)
  const economics = computeAccountEconomics(classified, attributed, velocity, settings, NOW)
  const dependency = computeTastingDependency(classified, attributed, velocity, economics)
  const health = classifyAccountHealth(orderMetrics, velocity, dependency, economics, unknownInventory, tastingMetrics, 200)

  assert.equal(economics.contribution, 225)
  assert.equal(economics.tastingSpend, 270)
  assert.equal(economics.netContribution, -45)
  assert.equal(dependency.status, 'unprofitable_cycle')
  assert.equal(health.kind, 'unprofitable')

  const decision = buildTastingDecision({ orders: orderMetrics, inventory: unknownInventory, tastings: attributed, velocity, dependency, economics, health, settings, now: NOW })
  assert.equal(decision.kind, 'not_recommended')
  assert.equal(decision.requiresAcknowledgement, true)
  assert.ok(decision.detail.some((line) => line.includes('costing Wisher more')))
})

test('an account that reorders on its own is healthy with zero dependency', () => {
  const orders = [order('2026-03-01', 0), order('2026-04-01', 1), order('2026-05-01', 2), order('2026-06-01', 3)]
  const tastings = [tasting('2026-03-05', 4)]
  const classified = classifyOrderAttribution(orders, tastings, settings)
  const attributed = attachTastingOrderAttribution(tastings, classified)
  const orderMetrics = computeOrderMetrics(classified, 0, NOW)
  const tastingMetrics = computeTastingMetrics(attributed, classified)
  const velocity = computeAccountVelocity(orderMetrics, classified, attributed, settings)
  const economics = computeAccountEconomics(classified, attributed, velocity, settings, NOW)
  const dependency = computeTastingDependency(classified, attributed, velocity, economics)
  const health = classifyAccountHealth(orderMetrics, velocity, dependency, economics, unknownInventory, tastingMetrics, 200)

  assert.equal(dependency.percent, 0)
  assert.equal(dependency.status, 'healthy')
  assert.equal(health.kind, 'growth')
  assert.equal(health.source, 'auto')

  const overridden = classifyAccountHealth(orderMetrics, velocity, dependency, economics, unknownInventory, tastingMetrics, 200, {
    kind: 'stalled',
    reason: 'Store is closing for renovation',
  })
  assert.equal(overridden.kind, 'stalled')
  assert.equal(overridden.autoKind, 'growth')
})

test('strategic tastings are kept out of retail spend', () => {
  const orders = [order('2026-05-01', 0), order('2026-06-01', 1)]
  const tastings = [tasting('2026-05-10', 2, { objective: 'strategic', cost: 500, costSource: 'estimate' })]
  const classified = classifyOrderAttribution(orders, tastings, settings)
  const attributed = attachTastingOrderAttribution(tastings, classified)
  const orderMetrics = computeOrderMetrics(classified, 0, NOW)
  const velocity = computeAccountVelocity(orderMetrics, classified, attributed, settings)
  const economics = computeAccountEconomics(classified, attributed, velocity, settings, NOW)
  assert.equal(economics.tastingSpend, 0)
  assert.equal(economics.strategicSpend, 500)
  assert.equal(computeTastingEconomics(tastings[0], classified, settings).excludedFromRetailRollup, true)
})
