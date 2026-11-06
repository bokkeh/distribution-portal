/* eslint-disable @typescript-eslint/no-require-imports -- Isolated database regression checks. */
const test = require('node:test')
const assert = require('node:assert/strict')
const { randomUUID } = require('node:crypto')
const { eq } = require('drizzle-orm')
const { createHarness } = require('./operator-harness.cjs')
let h
test.before(async () => { h = await createHarness() })
test.after(async () => h?.pg.close())

test('existing desktop notes are visible with author/date, pinned first and newest next', async () => {
  const schema = h.api.schema
  await h.runtime.db.insert(schema.accountNotes).values([
    { accountId: h.accountId, noteBody: 'Pinned older desktop note', isPinned: true, authorUserId: h.runtime.session.user.id, occurredAt: new Date('2025-01-01T12:00:00Z') },
    { accountId: h.accountId, noteBody: 'Newer desktop note\nSecond line', authorUserId: h.rachelId, occurredAt: new Date('2026-11-06T12:00:00Z') },
    { accountId: h.accountId, noteBody: 'Older note without author', occurredAt: new Date('2026-01-01T12:00:00Z') },
  ])
  const notes = await h.api.getFieldAccountNotes(h.accountId)
  assert.deepEqual(notes.map(note => note.body), ['Pinned older desktop note', 'Newer desktop note\nSecond line', 'Older note without author'])
  assert.equal(notes[1].author, 'Rachel')
  assert.equal(notes[1].occurredAt, '2026-11-06T12:00:00.000Z')
  assert.equal(notes[2].author, null)
})

test('saved quick notes reopen from the shared account table without duplicate retry rows', async () => {
  const id = randomUUID()
  assert.equal((await h.api.saveFieldNote(h.accountId, 'New mobile note', id)).success, true)
  assert.equal((await h.api.saveFieldNote(h.accountId, 'New mobile note', id)).success, true)
  const notes = await h.api.getFieldAccountNotes(h.accountId)
  assert.equal(notes.filter(note => note.id === id).length, 1)
  assert.equal(notes.find(note => note.id === id).body, 'New mobile note')
  const [desktop] = await h.runtime.db.select().from(h.api.schema.accountNotes).where(eq(h.api.schema.accountNotes.id, id))
  assert.equal(desktop.noteBody, 'New mobile note')
})

test('an account with no notes returns an empty history, never another account notes', async () => {
  const id = randomUUID()
  await h.runtime.db.insert(h.api.schema.customerAccounts).values({ id, companyName: 'No notes yet' })
  assert.deepEqual(await h.api.getFieldAccountNotes(id), [])
})

test('sales representatives can only read notes on their assigned accounts', async () => {
  const userId = h.rachelId, memberId = randomUUID()
  await h.runtime.db.insert(h.api.schema.salesMembers).values({ id: memberId, userId, status: 'active' })
  await h.runtime.db.update(h.api.schema.customerAccounts).set({ assignedSalesRepId: memberId }).where(eq(h.api.schema.customerAccounts.id, h.accountId))
  h.runtime.session.user = { id: userId, role: 'sales_rep', roles: ['sales_rep'] }
  assert.ok((await h.api.getFieldAccountNotes(h.accountId)).length)
  const id = randomUUID()
  await h.runtime.db.insert(h.api.schema.customerAccounts).values({ id, companyName: 'Other rep account' })
  await assert.rejects(h.api.getFieldAccountNotes(id), /do not have access/)
  h.runtime.session.user = { id: userId, role: 'customer', roles: ['customer'] }
  await assert.rejects(h.api.getFieldAccountNotes(h.accountId), /Unauthorized/)
})

