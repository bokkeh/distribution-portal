import assert from 'node:assert/strict'
import test from 'node:test'
import { getDeliveryDueDate, isValidDateOnly } from '../lib/orders/delivery-date'
import { validatePoFile, MAX_PO_BYTES } from '../lib/orders/po-files'
import { sortTasks } from '../lib/tasks/sort'
import { getAccountTastingLocations } from '../lib/tastings/locations'
import { getTastingAvailabilityMonthRange, tastingWindowsOverlap } from '../lib/tastings/windows'
import { getEasternDateKey, parseDateTimeInTimeZone } from '../lib/tastings/time'

test('Net 15 starts at delivery, remains unset without delivery, and handles month/year boundaries', () => {
  assert.equal(getDeliveryDueDate(null, 'NET15'), null)
  assert.equal(getDeliveryDueDate('2026-09-20', 'NET15'), '2026-10-05')
  assert.equal(getDeliveryDueDate('2026-12-25', 'NET15'), '2027-01-09')
  assert.equal(getDeliveryDueDate('2028-02-20', 'NET15'), '2028-03-06')
  assert.equal(getDeliveryDueDate('2026-09-20', 'PREPAID'), null)
  assert.equal(getDeliveryDueDate('2026-09-20', 'DUE_ON_RECEIPT'), '2026-09-20')
  assert.equal(getDeliveryDueDate('2026-09-20', '2/10_NET30'), '2026-10-20')
  assert.equal(getDeliveryDueDate('2026-09-20', 'custom terms'), null)
  assert.equal(isValidDateOnly('2026-02-30'), false)
})

test('completing a task moves it below open tasks without removing it or mutating source data', () => {
  const tasks = [
    { id: 'completed', status: 'completed', dueAt: '2026-01-01' },
    { id: 'later', status: 'open', dueAt: '2026-09-22' },
    { id: 'earlier', status: 'in_progress', dueAt: '2026-09-20' },
    { id: 'cancelled', status: 'cancelled', dueAt: '2026-01-02' },
  ]
  assert.deepEqual(sortTasks(tasks).map(task => task.id), ['earlier', 'later', 'cancelled', 'completed'])
  const updated = tasks.map(task => task.id === 'earlier' ? { ...task, status: 'completed' } : task)
  assert.deepEqual(sortTasks(updated).map(task => task.id), ['later', 'cancelled', 'completed', 'earlier'])
  assert.equal(tasks[2].status, 'in_progress')
  assert.equal(sortTasks(updated).length, 4)
})

test('PO uploads validate format and size and reject renamed executables', () => {
  const pdf = Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d])
  assert.equal(validatePoFile('MOCO.PDF', 20, pdf).contentType, 'application/pdf')
  assert.ok(validatePoFile('MOCO.pdf', MAX_PO_BYTES + 1, pdf).error)
  assert.ok(validatePoFile('MOCO.pdf', 0, pdf).error)
  assert.ok(validatePoFile('MOCO.exe', 20, pdf).error)
  assert.ok(validatePoFile('MOCO.pdf', 20, Uint8Array.from([0x4d, 0x5a])).error)
  assert.equal(validatePoFile('MOCO.png', 20, Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])).contentType, 'image/png')
})

test('booking reuses account primary and additional locations and tolerates malformed legacy data', () => {
  const account = { address: 'Main St', city: 'City', state: 'MD', zip: '20850', additionalLocations: JSON.stringify([{ address: 'Other St', city: 'Other City', state: 'MD', zip: '20852' }, null]) }
  const locations = getAccountTastingLocations(account)
  assert.equal(locations.length, 2)
  assert.equal(locations[0].zip, '20850')
  assert.equal(locations[1].zip, '20852')
  assert.equal(getAccountTastingLocations({ ...account, additionalLocations: 'invalid' }).length, 1)
})

test('booking conflict checks reject intersecting windows and permit adjacent windows in Eastern time', () => {
  const at = (time: string) => parseDateTimeInTimeZone('2026-09-20', time)
  assert.equal(tastingWindowsOverlap(at('16:00'), at('19:00'), at('18:00'), at('20:00')), true)
  assert.equal(tastingWindowsOverlap(at('16:00'), at('19:00'), at('19:00'), at('21:00')), false)
  assert.equal(getEasternDateKey(at('23:30')), '2026-09-20')
  assert.equal(at('16:00').toISOString(), '2026-09-20T20:00:00.000Z')
})

test('availability checks use valid month boundaries for September and leap years', () => {
  assert.deepEqual(getTastingAvailabilityMonthRange('2026-09-20'), { monthStart: '2026-09-01', monthEnd: '2026-09-30' })
  assert.equal(getTastingAvailabilityMonthRange('2028-02-20').monthEnd, '2028-02-29')
  assert.equal(getTastingAvailabilityMonthRange('2026-02-20').monthEnd, '2026-02-28')
})
