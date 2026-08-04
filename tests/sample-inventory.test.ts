import assert from 'node:assert/strict'
import test from 'node:test'
import { previousMonthWindow } from '../lib/inventory/report-period'
import { QUICKBOOKS_SAMPLE_CATEGORIES, SAMPLE_LOCATION_NAMES } from '../db/schema/sampleInventory'

test('sample inventory configuration preserves the required exact labels', () => {
  assert.deepEqual(SAMPLE_LOCATION_NAMES, [
    'Warehouse - Landover',
    'Kim - Samples Maryland',
    'Emily - Samples Chicago',
    'Kristen - Samples Kildeer',
  ])
  assert.deepEqual(QUICKBOOKS_SAMPLE_CATEGORIES, [
    'Tastings', 'Events (IRL)', 'Events (URL)', 'Giveaways', 'Charity Donations', 'Sales Calls',
  ])
})

test('monthly report selects the prior calendar month across a year boundary', () => {
  const window = previousMonthWindow(new Date('2026-01-15T18:00:00Z'))
  assert.equal(window.reportMonth, '2025-12')
  assert.equal(window.start.toISOString(), '2025-12-01T00:00:00.000Z')
  assert.equal(window.end.toISOString(), '2026-01-01T00:00:00.000Z')
})
