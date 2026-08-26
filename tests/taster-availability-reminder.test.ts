import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getAvailabilityReminderSchedule,
  getAvailabilityReminderSms,
  getTasterAvailabilityUrl,
} from '../lib/tastings/availability-reminder'

test('reminds seven days before the end of a 31-day month', () => {
  const schedule = getAvailabilityReminderSchedule(new Date('2026-08-24T14:00:00Z'))

  assert.equal(schedule.isDue, true)
  assert.equal(schedule.deadlineLabel, 'August 31, 2026')
  assert.equal(schedule.reminderDateLabel, 'August 24, 2026')
  assert.equal(schedule.periodKey, '2026-08')
})

test('handles February in a non-leap year', () => {
  const schedule = getAvailabilityReminderSchedule(new Date('2027-02-21T14:00:00Z'))

  assert.equal(schedule.isDue, true)
  assert.equal(schedule.deadlineLabel, 'February 28, 2027')
})

test('handles February in a leap year', () => {
  const schedule = getAvailabilityReminderSchedule(new Date('2028-02-22T14:00:00Z'))

  assert.equal(schedule.isDue, true)
  assert.equal(schedule.deadlineLabel, 'February 29, 2028')
})

test('does not activate on surrounding dates', () => {
  assert.equal(
    getAvailabilityReminderSchedule(new Date('2026-08-23T14:00:00Z')).isDue,
    false,
  )
  assert.equal(
    getAvailabilityReminderSchedule(new Date('2026-08-25T14:00:00Z')).isDue,
    false,
  )
})

test('SMS includes the deadline and live availability link', () => {
  const message = getAvailabilityReminderSms(
    'August 31, 2026',
    'https://portal.ahawc.com/taster/availability',
  )

  assert.match(message, /August 31, 2026/)
  assert.match(message, /https:\/\/portal\.ahawc\.com\/taster\/availability/)
})

test('production deployment URL takes precedence over a local auth URL', () => {
  const previousProductionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL
  const previousAuthUrl = process.env.NEXTAUTH_URL
  process.env.VERCEL_PROJECT_PRODUCTION_URL = 'distribution.example.com'
  process.env.NEXTAUTH_URL = 'http://localhost:3000'

  try {
    assert.equal(
      getTasterAvailabilityUrl(),
      'https://distribution.example.com/taster/availability',
    )
  } finally {
    if (previousProductionHost === undefined) delete process.env.VERCEL_PROJECT_PRODUCTION_URL
    else process.env.VERCEL_PROJECT_PRODUCTION_URL = previousProductionHost
    if (previousAuthUrl === undefined) delete process.env.NEXTAUTH_URL
    else process.env.NEXTAUTH_URL = previousAuthUrl
  }
})
