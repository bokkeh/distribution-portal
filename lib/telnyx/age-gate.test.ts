import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isAtLeast21 } from './age-gate'

const now = new Date('2026-10-06T17:00:00Z')
test('allows adults on their 21st birthday and blocks the day before', () => {
  assert.equal(isAtLeast21('2005-10-06', now), true)
  assert.equal(isAtLeast21('2005-10-07', now), false)
})
test('rejects missing, future, malformed and impossible birthdates', () => {
  for (const date of ['', null, '2000-2-1', '2001-02-29', '2000-13-01', '2027-01-01', '1899-01-01']) assert.equal(isAtLeast21(date, now), false)
  assert.equal(isAtLeast21('2000-02-29', now), true)
})
test('uses the Chicago calendar date instead of the UTC day', () => {
  assert.equal(isAtLeast21('2005-10-06', new Date('2026-10-06T01:00:00Z')), false)
})
