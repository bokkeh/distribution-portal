import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getSmsDeliveryUpdates, getMutableSmsStatuses } from './delivery-status'

test('carrier registration failure is a failure even after successful API submission', () => {
  const [update] = getSmsDeliveryUpdates({ to: [{ phone_number: '+15555550101', status: 'delivery_failed' }], errors: [{ code: '40010', detail: 'Not 10DLC registered' }] })
  assert.equal(update.status, 'failed')
  assert.equal(update.error, '40010: Not 10DLC registered')
})

test('preserves separate delivery results for each recipient', () => {
  const updates = getSmsDeliveryUpdates({ to: [{ phone_number: '+15555550101', status: 'delivered' }, { phone_number: '+15555550102', status: 'delivery_failed' }], errors: [{ code: '40010', detail: 'Not registered' }] })
  assert.equal(updates[0].status, 'delivered')
  assert.equal(updates[0].error, null)
  assert.equal(updates[1].status, 'failed')
})

test('accepted and unconfirmed messages are never called delivered', () => {
  assert.equal(getSmsDeliveryUpdates({ to: [{ phone_number: '+15555550101', status: 'queued' }] })[0].status, 'queued')
  assert.equal(getSmsDeliveryUpdates({ to: [{ phone_number: '+15555550101', status: 'delivery_unconfirmed' }] })[0].status, 'delivery_unconfirmed')
})

test('late sent/queued receipts cannot overwrite terminal results', () => {
  for (const next of ['queued', 'sent', 'delivered', 'failed'] as const) {
    const mutable = getMutableSmsStatuses(next)
    assert.equal(mutable.some(status => ['delivered', 'failed'].includes(status)), false)
  }
  assert.deepEqual(getMutableSmsStatuses('queued'), ['queued'])
  assert.equal(getMutableSmsStatuses('sent').includes('delivery_unconfirmed'), false)
  assert.equal(getMutableSmsStatuses('delivered').includes('delivery_unconfirmed'), true)
})

test('ignores incomplete or unknown provider payloads', () => {
  assert.deepEqual(getSmsDeliveryUpdates(null), [])
  assert.deepEqual(getSmsDeliveryUpdates({ to: [{ status: 'delivered' }, { phone_number: '+15555550101', status: 'unknown' }] }), [])
})
