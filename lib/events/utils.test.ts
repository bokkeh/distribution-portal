import assert from 'node:assert/strict'
import test from 'node:test'
import { getDirectionsUrl, localEventDateTimeToUtc, parseGuestNames, slugifyEventTitle } from './utils'

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
