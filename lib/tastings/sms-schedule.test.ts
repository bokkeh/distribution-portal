import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getTastingSmsDisposition, getTastingSmsSchedule } from './sms-schedule'

const start = new Date('2026-10-03T20:00:00Z')
const end = new Date('2026-10-03T23:00:00Z')

test('suppresses Manuel’s late tomorrow reminder on the event day', () => {
  assert.equal(getTastingSmsDisposition('day_before_reminder', start, end, new Date('2026-10-03T09:31:42Z')), 'cancel')
  assert.equal(getTastingSmsDisposition('day_before_reminder', start, end, new Date('2026-10-02T20:05:00Z')), 'send')
})

test('uses Eastern calendar dates near midnight', () => {
  assert.equal(getTastingSmsDisposition('day_before_reminder', start, end, new Date('2026-10-03T03:59:00Z')), 'send')
  assert.equal(getTastingSmsDisposition('day_before_reminder', start, end, new Date('2026-10-03T04:00:00Z')), 'cancel')
})

test('reschedules jobs when the current event has moved later', () => {
  assert.equal(getTastingSmsDisposition('day_before_reminder', new Date('2026-10-10T20:00:00Z'), null, start), 'reschedule')
})

test('does not send today reminders after start or live prompts after their window', () => {
  assert.equal(getTastingSmsDisposition('day_of_reminder', start, end, start), 'cancel')
  assert.equal(getTastingSmsDisposition('checkin_prompt', start, end, new Date('2026-10-03T21:30:00Z')), 'cancel')
  assert.equal(getTastingSmsDisposition('mid_event_check', start, end, end), 'cancel')
  assert.equal(getTastingSmsDisposition('end_of_tasting', start, end, new Date('2026-10-04T09:00:00Z')), 'cancel')
})

test('computes event windows and two hour fallback consistently', () => {
  assert.equal(getTastingSmsSchedule(start, end).mid_event_check.toISOString(), '2026-10-03T21:30:00.000Z')
  assert.equal(getTastingSmsSchedule(start, null).end_of_tasting.toISOString(), '2026-10-03T22:00:00.000Z')
})

test('tomorrow stays accurate across daylight saving transitions', () => {
  const springStart = new Date('2026-03-09T04:30:00Z')
  const schedule = getTastingSmsSchedule(springStart, null)
  assert.equal(schedule.day_before_reminder.toISOString(), '2026-03-08T05:30:00.000Z')
  assert.equal(getTastingSmsDisposition('day_before_reminder', springStart, null, new Date('2026-03-08T04:45:00Z')), 'reschedule')
  assert.equal(getTastingSmsDisposition('day_before_reminder', springStart, null, new Date('2026-03-08T06:00:00Z')), 'send')
})

test('short events do not receive check-in prompts after ending', () => {
  const shortEnd = new Date('2026-10-03T20:15:00Z')
  assert.equal(getTastingSmsDisposition('checkin_prompt', start, shortEnd, new Date('2026-10-03T20:20:00Z')), 'cancel')
})
