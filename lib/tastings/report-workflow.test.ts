import assert from 'node:assert/strict'
import test from 'node:test'
import { isActiveTasterTasting, needsTastingReport } from './report-workflow'

const start = new Date('2026-10-03T17:00:00Z')
const tasting = { scheduledAt: start, status: 'confirmed', reportSubmittedAt: null }

test('assignment remains active before, at, and after its start until reported', () => {
  for (const offset of [-1, 0, 1, 86400000]) {
    const now = new Date(start.getTime() + offset)
    assert.equal(isActiveTasterTasting(tasting, now), true)
    assert.equal(needsTastingReport(tasting, now), offset >= 0)
  }
})

test('completed assignments with missing reports remain active', () => {
  assert.equal(isActiveTasterTasting({ ...tasting, status: 'completed' }, start), true)
})

test('submitted and inactive assignments leave the open report workflow', () => {
  for (const row of [
    { ...tasting, reportSubmittedAt: start },
    ...['requested', 'cancelled', 'declined'].map(status => ({ ...tasting, status })),
  ]) {
    assert.equal(isActiveTasterTasting(row, start), false)
    assert.equal(needsTastingReport(row, start), false)
  }
})
