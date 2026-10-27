/* eslint-disable @typescript-eslint/no-require-imports -- Isolated server-action integration tests. */
const test = require('node:test')
const assert = require('node:assert/strict')
const { randomUUID } = require('node:crypto')
const { eq } = require('drizzle-orm')
const { createHarness } = require('./operator-harness.cjs')

let h, otherAccountId, memberId
test.before(async () => {
  h = await createHarness()
  otherAccountId = randomUUID(); memberId = randomUUID()
  await h.runtime.db.insert(h.api.schema.customerAccounts).values({ id: otherAccountId, companyName: 'Overview Other Venue' })
  await h.runtime.db.insert(h.api.schema.salesMembers).values({ id: memberId, userId: h.runtime.session.user.id, status: 'active' })
  await h.runtime.db.update(h.api.schema.customerAccounts).set({ assignedSalesRepId: memberId }).where(eq(h.api.schema.customerAccounts.id, h.accountId))
  const now = Date.now(), day = 86400000
  const row = values => ({ customerId: h.accountId, createdByUserId: h.runtime.session.user.id, eventName: 'Overview visit', scheduledAt: new Date(now + 100 * day), status: 'scheduled', ...values })
  await h.runtime.db.insert(h.api.schema.tastings).values([
    ...Array.from({ length: 52 }, (_, i) => row({ eventName: `Overview visit ${i}`, assignedUserId: i === 0 ? h.rachelId : null, scheduledAt: new Date(now + (100 + i) * day) })),
    row({ customerId: otherAccountId, eventName: 'Overview requested visit', status: 'requested', scheduledAt: new Date(now + day) }),
    row({ eventName: 'Overview in progress', scheduledAt: new Date(now - 3600000), endAt: new Date(now + 3600000), status: 'confirmed' }),
    row({ eventName: 'Overview completed visit', scheduledAt: new Date(now - day), status: 'completed' }),
    row({ customerId: otherAccountId, eventName: 'Overview cancelled visit', status: 'cancelled' }),
    row({ eventName: 'Overview declined visit', status: 'declined' }),
  ])
})
test.after(async () => h?.pg.close())

test('overview reads across accounts without selecting an account and paginates in chronological order', async () => {
  const first = await h.api.getFieldTastings({ query: 'Overview' })
  assert.equal(first.total, 54)
  assert.equal(first.rows.length, 50)
  assert.equal(first.hasMore, true)
  assert.equal(first.rows[0].eventName, 'Overview in progress')
  assert.ok(first.rows.some(row => row.accountId === otherAccountId && row.status === 'requested'))
  assert.ok(first.rows.some(row => row.assignee === 'Unassigned'))
  const second = await h.api.getFieldTastings({ query: 'Overview', offset: first.nextOffset })
  assert.equal(second.rows.length, 4)
  assert.equal(second.hasMore, false)
  assert.equal(new Set([...first.rows, ...second.rows].map(row => row.id)).size, 54)
})

test('past and all filters include historical and cancelled records accurately', async () => {
  const past = await h.api.getFieldTastings({ period: 'past', query: 'Overview' })
  assert.equal(past.total, 1)
  assert.equal(past.rows[0].status, 'completed')
  const all = await h.api.getFieldTastings({ period: 'all', query: 'Overview' })
  assert.equal(all.total, 57)
  const remaining = await h.api.getFieldTastings({ period: 'all', query: 'Overview', offset: all.nextOffset })
  assert.ok([...all.rows, ...remaining.rows].some(row => row.status === 'cancelled'))
  assert.ok([...all.rows, ...remaining.rows].some(row => row.status === 'declined'))
})

test('search can find the assigned taster', async () => {
  const result = await h.api.getFieldTastings({ query: 'Rachel' })
  assert.equal(result.total, 1)
  assert.equal(result.rows[0].assignee, 'Rachel')
})

test('sales reps only receive tastings and counts for their assigned accounts', async () => {
  const original = h.runtime.session
  h.runtime.session = { user: { ...original.user, role: 'sales_rep', roles: ['sales_rep'] } }
  try {
    const result = await h.api.getFieldTastings({ period: 'all', query: 'Overview' })
    assert.equal(result.total, 55)
    assert.ok(result.rows.every(row => row.accountId === h.accountId))
    assert.equal((await h.api.getFieldTastings({ query: 'Overview Other Venue' })).total, 0)
    await h.runtime.db.update(h.api.schema.salesMembers).set({ status: 'inactive' }).where(eq(h.api.schema.salesMembers.id, memberId))
    await assert.rejects(h.api.getFieldTastings(), /active sales profile/)
  } finally { h.runtime.session = original }
})

test('unauthorized roles cannot read the overview', async () => {
  const original = h.runtime.session
  h.runtime.session = { user: { ...original.user, role: 'customer', roles: ['customer'] } }
  try { await assert.rejects(h.api.getFieldTastings(), /Unauthorized/) }
  finally { h.runtime.session = original }
})
