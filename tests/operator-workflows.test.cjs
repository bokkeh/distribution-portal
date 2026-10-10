/* eslint-disable @typescript-eslint/no-require-imports -- Tests load the CommonJS isolation harness. */
const test = require('node:test')
const assert = require('node:assert/strict')
const { randomUUID } = require('node:crypto')
const { eq, asc } = require('drizzle-orm')
const { createHarness } = require('./operator-harness.cjs')

let h
test.before(async () => { h = await createHarness() })
test.after(async () => { await h?.pg.close() })
const booking = overrides => ({ requestId: randomUUID(), accountId: h.accountId, date: '2030-11-06', startTime: '16:00', endTime: '19:00', timeZone: 'America/New_York', assignedUserId: null, ...overrides })
const observation = overrides => {
  const data = { requestId: randomUUID(), accountId: h.accountId, productId: h.productId, observedOn: '2030-11-06', observedTime: '16:00', timeZone: 'America/New_York', currency: 'USD', priceType: 'regular', productSize: '750 mL', notes: '', bottlesOnHand: '', price: '', ...overrides }
  const form = new FormData(); for (const [key, value] of Object.entries(data)) form.set(key, value)
  return form
}

test('creation is persisted and immediately visible when unassigned in upcoming/account views', async () => {
  h.runtime.paths.length = 0
  const input = booking()
  const result = await h.api.quickScheduleTasting(input)
  assert.equal(result.success, true)
  assert.match(result.confirmation, /Unassigned/)
  const views = await h.api.getTastingsForViewWithFallback({})
  const saved = views.find(row => row.id === result.tastingId)
  assert.ok(saved)
  assert.equal(saved.scheduledAt.toISOString(), '2030-11-06T21:00:00.000Z')
  assert.equal(saved.endAt.toISOString(), '2030-11-07T00:00:00.000Z')
  assert.equal(saved.assignedUserId, null)
  assert.equal(saved.tasterName, 'Unassigned')
  assert.equal(h.api.isUpcomingTasting(saved), true)
  assert.equal((await h.api.getAccountTastingSummary(h.accountId)).nextTasting.id, saved.id)
  for (const path of ['/admin/tastings', '/staff/tastings', '/taster/tastings', '/sales/tastings', '/admin/dashboard', `/admin/crm/${h.accountId}`]) assert.ok(h.runtime.paths.includes(path), path)
})

test('reassignment persists after a fresh read, clears confirmation, and refreshes all views even with a notification outage', async () => {
  const input = booking({ date: '2030-11-08' })
  const created = await h.api.quickScheduleTasting(input)
  await h.runtime.db.update(h.api.schema.tastings).set({ status: 'confirmed' }).where(eq(h.api.schema.tastings.id, created.tastingId))
  const data = new FormData(); data.set('tastingId', created.tastingId); data.set('assignedUserId', h.rachelId)
  await assert.rejects(h.api.reassignTasting(data), error => /Assignment saved/.test(decodeURIComponent(error.url ?? '')))
  const [saved] = await h.runtime.db.select().from(h.api.schema.tastings).where(eq(h.api.schema.tastings.id, created.tastingId))
  assert.equal(saved.assignedUserId, h.rachelId)
  assert.equal(saved.status, 'scheduled')
  assert.equal((await h.api.getTastingsForViewWithFallback({ assignedUserId: h.rachelId })).find(row => row.id === created.tastingId).tasterName, 'Rachel')
  // Notification callbacks execute after a successful response; outages cannot undo it.
  const callbacks = h.runtime.after.splice(0)
  const original = console.error; console.error = () => {}
  try { for (const callback of callbacks) await callback() } finally { console.error = original }
  const reloaded = await h.api.getTastingsForViewWithFallback({})
  assert.equal(reloaded.find(row => row.id === created.tastingId).assignedUserId, h.rachelId)
  data.set('assignedUserId', '')
  await assert.rejects(h.api.reassignTasting(data), error => /Unassigned/.test(decodeURIComponent(error.url ?? '')))
  assert.equal((await h.api.getTastingsForViewWithFallback({})).find(row => row.id === created.tastingId).assignedUserId, null)
})

test('repeated requests and concurrent taps return one tasting and changed retries are rejected', async () => {
  const input = booking({ date: '2030-12-01' })
  const results = await Promise.all([h.api.quickScheduleTasting(input), h.api.quickScheduleTasting(input)])
  assert.ok(results.every(result => result.success))
  assert.equal(results[0].tastingId, results[1].tastingId)
  const rows = await h.runtime.db.select().from(h.api.schema.tastings).where(eq(h.api.schema.tastings.id, input.requestId))
  assert.equal(rows.length, 1)
  const retry = await h.api.quickScheduleTasting(input)
  assert.equal(retry.tastingId, input.requestId)
  const changed = await h.api.quickScheduleTasting({ ...input, endTime: '20:00' })
  assert.match(changed.error, /already saved with different details/)
})

test('minimal new venues can be enriched later and normalized existing names do not create duplicates', async () => {
  const input = booking({ accountId: null, venueName: 'New Venue', date: '2030-12-02' })
  const result = await h.api.quickScheduleTasting(input)
  assert.equal(result.success, true)
  const [venue] = await h.runtime.db.select().from(h.api.schema.customerAccounts).where(eq(h.api.schema.customerAccounts.id, result.accountId))
  assert.equal(venue.contactName, null)
  assert.equal(venue.dealStage, null)
  assert.equal((await h.api.quickScheduleTasting(input)).tastingId, result.tastingId)
  const duplicate = await h.api.quickScheduleTasting(booking({ accountId: null, venueName: ' Test   Venue ', date: '2030-12-03' }))
  assert.match(duplicate.error, /already exists/)
  assert.equal(duplicate.matches[0].id, h.accountId)
})

test('standalone contacts save without email/phone/company, keep in touch, and link later without a sales stage', async () => {
  const data = new FormData(); data.set('kind', 'company'); data.set('firstName', 'Standalone'); data.set('relationshipStatus', 'keep_in_touch')
  assert.equal((await h.api.createCrmPerson(null, data)).success, true)
  const [contact] = await h.runtime.db.select().from(h.api.schema.contacts).where(eq(h.api.schema.contacts.name, 'Standalone'))
  assert.ok(contact)
  assert.equal(contact.customerId, null)
  assert.equal(contact.email, null)
  assert.equal(contact.relationshipStatus, 'keep_in_touch')
  assert.equal(contact.dealStage, null)
  const link = new FormData(); link.set('customerId', h.accountId); link.set('relationshipStatus', 'keep_in_touch')
  assert.equal((await h.api.updateContactRelationship(contact.id, link)).success, true)
  const [linked] = await h.runtime.db.select().from(h.api.schema.contacts).where(eq(h.api.schema.contacts.id, contact.id))
  assert.equal(linked.customerId, h.accountId)
  assert.equal(linked.relationshipStatus, 'keep_in_touch')
})

test('inventory-only, price-only and combined observations save independently; price history is append-only on retries', async () => {
  const inventory = await h.api.saveAccountObservations(observation({ bottlesOnHand: '12' }))
  assert.equal(inventory.inventorySaved, true)
  assert.equal(inventory.priceSaved, false)
  assert.equal((await h.api.getAccountPriceHistory(h.accountId)).length, 0)
  const before = await h.runtime.db.select().from(h.api.schema.accountInventoryAdjustments)
  const priceData = observation({ price: '24.99' })
  const price = await h.api.saveAccountObservations(priceData)
  assert.equal(price.priceSaved, true)
  assert.equal(price.inventorySaved, false)
  assert.equal((await h.runtime.db.select().from(h.api.schema.accountInventoryAdjustments)).length, before.length)
  assert.equal((await h.api.saveAccountObservations(priceData)).priceSaved, true)
  assert.equal((await h.api.getAccountPriceHistory(h.accountId)).length, 1)
  assert.equal((await h.api.saveAccountObservations(observation({ bottlesOnHand: '8', price: '19.99', observedOn: '2030-11-07', priceType: 'promotional' }))).success, true)
  const history = await h.api.getAccountPriceHistory(h.accountId)
  assert.deepEqual(history.map(row => row.price), ['19.99', '24.99'])
  assert.equal(history[0].currency, 'USD')
  assert.equal(history[0].priceType, 'promotional')
  const [snapshot] = await h.runtime.db.select().from(h.api.schema.accountInventoryOnHand)
  assert.equal(Number(snapshot.bottlesOnHand), 8)
  const countBefore = (await h.runtime.db.select().from(h.api.schema.accountInventoryAdjustments)).length
  assert.ok((await h.api.saveAccountObservations(observation({ bottlesOnHand: '7', price: '-1' }))).error)
  assert.equal((await h.runtime.db.select().from(h.api.schema.accountInventoryAdjustments)).length, countBefore)
})

test('timezone boundaries, invalid wall times, and in-progress upcoming visibility', async () => {
  const central = booking({ date: '2030-12-31', startTime: '22:00', endTime: '23:30', timeZone: 'America/Chicago' })
  const saved = await h.api.quickScheduleTasting(central)
  const row = (await h.api.getTastingsForViewWithFallback({})).find(row => row.id === saved.tastingId)
  assert.equal(row.scheduledAt.toISOString(), '2031-01-01T04:00:00.000Z')
  assert.equal(row.timeZone, 'America/Chicago')
  assert.equal(h.api.isUpcomingTasting(row, Date.parse('2031-01-01T05:00:00Z')), true)
  assert.equal(h.api.isUpcomingTasting(row, Date.parse('2031-01-01T05:30:00Z')), false)
  assert.equal(h.api.isUpcomingTasting({ ...row, status: 'completed' }), false)
  assert.ok((await h.api.quickScheduleTasting(booking({ date: '2028-03-12', startTime: '02:30' }))).error)
  assert.ok((await h.api.quickScheduleTasting(booking({ date: '2028-11-05', startTime: '01:30' }))).error)
  assert.ok((await h.api.quickScheduleTasting(booking({ date: '2030-02-30' }))).error)
})

test('visibility honors taster ownership and sales account assignment', async () => {
  const original = h.runtime.session
  try {
    h.runtime.session = { user: { ...original.user, id: h.rachelId, role: 'taster', roles: ['taster'] } }
    const scoped = await h.api.getTastingsForView({ assignedUserId: original.user.id })
    assert.ok(scoped.every(row => row.assignedUserId === h.rachelId))
    h.runtime.session = { user: { ...original.user, role: 'sales_rep', roles: ['sales_rep'] } }
    assert.deepEqual(await h.api.getTastingsForView({}), [])
  } finally { h.runtime.session = original }
})


test('migration preserves historical assignment, company links and date-only prices without invented times', async () => {
  const tasting = (await h.pg.query("SELECT assigned_user_id, scheduled_at, status, scheduling_fingerprint FROM tastings WHERE id='90000000-0000-4000-8000-000000000004'")).rows[0]
  assert.equal(tasting.assigned_user_id, '90000000-0000-4000-8000-000000000001')
  assert.equal(new Date(tasting.scheduled_at).toISOString(), '2025-10-17T20:00:00.000Z')
  assert.equal(tasting.status, 'completed'); assert.equal(tasting.scheduling_fingerprint, null)
  const contact = (await h.pg.query("SELECT customer_id,relationship_status FROM contacts WHERE id='90000000-0000-4000-8000-000000000005'")).rows[0]
  assert.equal(contact.customer_id, '90000000-0000-4000-8000-000000000002'); assert.equal(contact.relationship_status, null)
  const price = (await h.pg.query("SELECT price,observed_on,observed_at,price_type FROM account_price_history WHERE id='90000000-0000-4000-8000-000000000006'")).rows[0]
  assert.equal(String(price.price), '23.99'); assert.equal(new Date(price.observed_on).toISOString().slice(0,10), '2025-10-17'); assert.equal(price.observed_at, null); assert.equal(price.price_type, 'unspecified')
})

test('inventory-only observations enforce account scope for sales representatives', async () => {
  const previous = h.runtime.session
  try {
    h.runtime.session = { user: { ...previous.user, role: 'sales_rep', roles: ['sales_rep'] } }
    const result = await h.api.saveAccountObservations(observation({ bottlesOnHand: '99' }))
    assert.ok(result.error)
  } finally { h.runtime.session = previous }
})


test('report date ranges and venue-local reminder dates honor DST and year boundaries', () => {
  const spring = h.api.getReportDateRange('2028-03-12', '2028-03-12')
  assert.equal(spring.fromDate.toISOString(), '2028-03-12T05:00:00.000Z')
  assert.equal(spring.toDate.toISOString(), '2028-03-13T03:59:59.999Z')
  assert.equal(h.api.getReportDateRange(undefined, '2030-12-31').toDate.toISOString(), '2031-01-01T04:59:59.999Z')
  const reminders = h.api.getTastingSmsSchedule(new Date('2031-01-01T04:00:00Z'), new Date('2031-01-01T05:30:00Z'), 'America/Chicago')
  assert.equal(reminders.day_before_reminder.toISOString(), '2030-12-30T14:00:00.000Z')
  assert.equal(reminders.day_of_reminder.toISOString(), '2030-12-31T14:00:00.000Z')
})


test('dashboard filters before pagination and keeps the nearest newly scheduled tasting visible', async () => {
  for (let day = 1; day <= 11; day++) {
    assert.equal((await h.api.quickScheduleTasting(booking({ date: `2040-01-${String(day).padStart(2,'0')}` }))).success, true)
  }
  const near = await h.api.quickScheduleTasting(booking({ date: '2030-01-02' }))
  const { tastings } = h.api.schema
  const rows = await h.runtime.db.select().from(tastings).where(h.api.upcomingTastingFilter(new Date('2030-01-01T00:00:00Z'))).orderBy(asc(tastings.scheduledAt)).limit(4)
  assert.equal(rows[0].id, near.tastingId)
  assert.ok(rows.every(row => ['requested','scheduled','confirmed'].includes(row.status)))
})
