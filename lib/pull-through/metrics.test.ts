import assert from 'node:assert/strict'
import test from 'node:test'
import { addDays, computeInventoryPosition, computeOrderMetrics, computeReorderLikelihood } from './metrics'
import type { PullThroughOrder } from './types'

const NOW = new Date('2026-09-14T12:00:00Z')

function order(daysAgo: number, index: number, bottles = 12): PullThroughOrder {
  return {
    id: `o${index}`,
    accountId: 'a1',
    orderedAt: addDays(NOW, -daysAgo),
    orderType: 'paid',
    status: 'delivered',
    cases: bottles / 12,
    bottles,
    total: bottles * 20,
    sequenceIndex: index,
    isReorder: index > 0,
    attribution: null,
  }
}

/** Builds an account that reorders every `cadence` days, last ordering `sinceLast` days ago. */
function metricsFor(cadence: number, sinceLast: number, count = 4) {
  const orders: PullThroughOrder[] = []
  for (let i = count - 1; i >= 0; i -= 1) {
    orders.push(order(sinceLast + i * cadence, count - 1 - i))
  }
  return computeOrderMetrics(orders, 0, NOW)
}

const unknownInventory = computeInventoryPosition(null, 0, null, 12, NOW)

test('no pattern without two dated orders', () => {
  const single = computeOrderMetrics([order(20, 0)], 0, NOW)
  const result = computeReorderLikelihood(single, unknownInventory)
  assert.equal(result.level, 'unknown')
  assert.equal(result.score, null)
  assert.equal(result.cyclePosition, null)
})

test('inside the reorder window is very likely', () => {
  const result = computeReorderLikelihood(metricsFor(30, 29), unknownInventory)
  assert.equal(result.cyclePosition, 'due')
  assert.equal(result.level, 'very_likely')
  assert.match(result.headline, /Due now/)
  assert.ok(result.expectedFrom && result.expectedTo)
})

test('early in the cycle ranks well below due', () => {
  const early = computeReorderLikelihood(metricsFor(30, 5), unknownInventory)
  const due = computeReorderLikelihood(metricsFor(30, 29), unknownInventory)
  assert.equal(early.cyclePosition, 'early')
  assert.ok(early.level === 'unlikely' || early.level === 'possible')
  assert.ok((early.score ?? 0) < (due.score ?? 0) - 40)
})

test('a broken pattern drops back down even though it is overdue', () => {
  const overdue = computeReorderLikelihood(metricsFor(30, 45), unknownInventory)
  assert.equal(overdue.cyclePosition, 'overdue')
  assert.equal(overdue.level, 'likely')

  const broken = computeReorderLikelihood(metricsFor(30, 90), unknownInventory)
  assert.equal(broken.cyclePosition, 'broken')
  assert.equal(broken.level, 'unlikely')
  assert.ok((broken.score ?? 0) < (overdue.score ?? 0))
})

test('low stock raises likelihood; a shelf full of stock lowers it', () => {
  const orders = metricsFor(30, 22)
  const baseline = computeReorderLikelihood(orders, unknownInventory)

  const lowStock = computeInventoryPosition(
    { bottles: 3, cases: 0.25, productCount: 1, lastConfirmedAt: addDays(NOW, -1), lastConfirmedByName: null, lastConfirmedByRole: null, source: null },
    0,
    orders.bottlesPerDay,
    12,
    NOW,
  )
  const fullShelf = computeInventoryPosition(
    { bottles: 120, cases: 10, productCount: 1, lastConfirmedAt: addDays(NOW, -1), lastConfirmedByName: null, lastConfirmedByRole: null, source: null },
    0,
    orders.bottlesPerDay,
    12,
    NOW,
  )

  assert.ok((computeReorderLikelihood(orders, lowStock).score ?? 0) > (baseline.score ?? 0))
  assert.ok((computeReorderLikelihood(orders, fullShelf).score ?? 0) < (baseline.score ?? 0))
})
