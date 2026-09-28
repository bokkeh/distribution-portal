import assert from 'node:assert/strict'
import test from 'node:test'
import { describeDueDateGuidance, getDeliveryDueDate } from '../lib/orders/delivery-date'
import { tastingNeedsCoverage, CANCELLATION_REASON_OPTIONS } from '../lib/tastings/cancellation'

test('due-date guidance reflects delivery date presence and Net terms', () => {
  assert.equal(describeDueDateGuidance(null, 'NET15'), 'Due 15 days after delivery. Due date will calculate when delivery is confirmed.')
  assert.equal(describeDueDateGuidance('2026-09-20', 'NET15'), `Due 15 days after delivery (${getDeliveryDueDate('2026-09-20', 'NET15')}).`)
  assert.equal(describeDueDateGuidance(null, 'PREPAID'), 'Due date will calculate when delivery is confirmed.')
  assert.equal(describeDueDateGuidance('2026-09-20', 'PREPAID'), 'No delivery-based due date for these payment terms.')
  assert.equal(describeDueDateGuidance('2026-09-20', 'DUE_ON_RECEIPT'), 'Due on delivery (2026-09-20).')
})

test('a cancelled tasting needs coverage unless the venue itself cancelled the event', () => {
  assert.equal(tastingNeedsCoverage('cancelled', 'sick_emergency'), true)
  assert.equal(tastingNeedsCoverage('cancelled', 'schedule_conflict'), true)
  assert.equal(tastingNeedsCoverage('cancelled', 'venue_cancelled'), false)
  assert.equal(tastingNeedsCoverage('confirmed', 'venue_cancelled'), false)
  assert.equal(tastingNeedsCoverage('cancelled', null), true)
})

test('cancellation reason options include the exact set the taster picks from, with Other last', () => {
  const values = CANCELLATION_REASON_OPTIONS.map((option) => option.value)
  assert.deepEqual(values, [
    'sick_emergency',
    'schedule_conflict',
    'venue_cancelled',
    'weather',
    'transportation',
    'no_longer_available',
    'other',
  ])
})
