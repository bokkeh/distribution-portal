import assert from 'node:assert/strict'
import test from 'node:test'
import { getDirectionsUrl, getEventDraftReasons, getEventLifecycleBucket, localEventDateTimeToUtc, parseGuestNames, slugifyEventTitle } from './utils'

test('slugifyEventTitle creates stable public slugs', () => {
  assert.equal(slugifyEventTitle('Wisher Summer Party 2026!'), 'wisher-summer-party-2026')
  assert.equal(slugifyEventTitle('  Dîner & Rosé  '), 'diner-rose')
})

test('parseGuestNames accepts commas and new lines', () => {
  assert.deepEqual(parseGuestNames('Alex, Sam\nJordan'), ['Alex', 'Sam', 'Jordan'])
})

test('getDirectionsUrl safely encodes an event address', () => {
  assert.equal(
    getDirectionsUrl('123 Main St, Washington, DC'),
    'https://www.google.com/maps/dir/?api=1&destination=123%20Main%20St%2C%20Washington%2C%20DC',
  )
})

test('localEventDateTimeToUtc honors the selected event time zone', () => {
  assert.equal(
    localEventDateTimeToUtc('2026-08-22', '19:00', 'America/New_York').toISOString(),
    '2026-08-22T23:00:00.000Z',
  )
})

test('a complete internal-only future event is upcoming', () => {
  const event = {
    title: 'Internal activation',
    status: 'scheduled',
    startAt: new Date('2026-09-10T18:00:00Z'),
    endAt: new Date('2026-09-10T21:00:00Z'),
    venueName: 'Wisher HQ',
  }
  assert.equal(getEventLifecycleBucket(event, new Date('2026-09-04T12:00:00Z')), 'upcoming')
})

test('upcoming versus past uses the event end time, not creation time', () => {
  const base = { title: 'Activation', status: 'scheduled', venueName: 'Wisher HQ' }
  assert.equal(getEventLifecycleBucket({ ...base, startAt: new Date('2026-09-04T11:00:00Z'), endAt: new Date('2026-09-04T13:00:00Z') }, new Date('2026-09-04T12:00:00Z')), 'upcoming')
  assert.equal(getEventLifecycleBucket({ ...base, startAt: new Date('2026-09-04T09:00:00Z'), endAt: new Date('2026-09-04T11:59:59Z') }, new Date('2026-09-04T12:00:00Z')), 'past')
})

test('incomplete events stay visible as drafts with actionable reasons', () => {
  const event = { title: 'Future idea', status: 'scheduled', startAt: null, endAt: null }
  assert.equal(getEventLifecycleBucket(event, new Date('2026-09-04T12:00:00Z')), 'draft')
  assert.deepEqual(getEventDraftReasons(event), ['event date and start time', 'end time', 'location'])
})

test('explicit completed and cancelled lifecycles win over date classification', () => {
  const event = { title: 'Activation', startAt: new Date('2026-09-10T18:00:00Z'), endAt: new Date('2026-09-10T21:00:00Z'), city: 'Washington' }
  assert.equal(getEventLifecycleBucket({ ...event, status: 'completed' }, new Date('2026-09-04T12:00:00Z')), 'past')
  assert.equal(getEventLifecycleBucket({ ...event, status: 'cancelled' }, new Date('2026-09-04T12:00:00Z')), 'cancelled')
})
