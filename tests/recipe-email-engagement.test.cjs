/* eslint-disable @typescript-eslint/no-require-imports -- Isolated email analytics and route regression checks. */
const test = require('node:test')
const assert = require('node:assert/strict')
const { randomUUID } = require('node:crypto')
const path = require('node:path')
const { build } = require('esbuild')
const { eq } = require('drizzle-orm')
const { createHarness } = require('./operator-harness.cjs')
let h, sendId, contactId, routes
test.before(async () => {
  process.env.COMMUNITY_EMAIL_SECRET = 'isolated-recipe-analytics-test-secret'
  h = await createHarness(); sendId = randomUUID(); contactId = randomUUID()
  await h.runtime.db.insert(h.api.schema.communityContacts).values({ id: contactId, firstName: 'Test', lastName: 'Reader', email: 'reader@example.test', phone: '', source: 'admin_entry' })
  await h.runtime.db.insert(h.api.schema.communityRecipeEmails).values({ id: sendId, weekKey: '2026-11-02', recipeHandle: 'test', recipeTitle: 'Test recipe', recipeUrl: 'https://wishervodka.com/recipe', subject: 'Recipe', sentCount: 10, recipientCount: 10, status: 'sent' })
  global.__recipeEngagementRecord = input => h.api.recordRecipeEmailEngagement(input)
  const outfile = path.resolve(`tmp/operator-tests/recipe-routes-${process.pid}.cjs`)
  await build({ stdin: { contents: "export { GET as open, HEAD as openHead } from './app/api/community/email/open/route'; export { GET as click, HEAD as clickHead } from './app/api/community/email/click/route'", resolveDir: process.cwd(), loader: 'ts' }, bundle: true, platform: 'node', format: 'cjs', packages: 'external', outfile, plugins: [{ name: 'isolated-record-boundary', setup(b) {
    b.onResolve({ filter: /^@\/lib\/marketing\/recipe-email-engagement-data$/ }, () => ({ path: 'record', namespace: 'test' }))
    b.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: 'export const recordRecipeEmailEngagement = input => globalThis.__recipeEngagementRecord(input)', loader: 'js' }))
  } }] })
  routes = require(outfile)
})
test.after(async () => h?.pg.close())
function request(kind, token) { return { nextUrl: new URL(`https://portal.ahawc.com/api/community/email/${kind}?token=${encodeURIComponent(token)}`) } }
function token(kind, url) { return h.api.createRecipeTrackingToken({ sendId, contactId, kind, ...(url ? { url } : {}) }) }

test('historical sends remain untracked until signed tracking is enabled for that run', async () => {
  assert.equal((await h.api.getRecipeEmailEngagement([{ id: sendId, sentCount: 10 }])).get(sendId).tracked, false)
  await h.api.markRecipeEmailTracking(sendId); await h.api.markRecipeEmailTracking(sendId)
  const value = (await h.api.getRecipeEmailEngagement([{ id: sendId, sentCount: 10 }])).get(sendId)
  assert.equal(value.tracked, true); assert.equal(value.openRate, 0)
})

test('public open pixel verifies tokens, disables caching and ignores invalid/HEAD requests', async () => {
  const initial = (await h.runtime.db.select().from(h.api.schema.activityEvents)).length
  const invalid = await routes.open(request('open', 'invalid'))
  assert.equal(invalid.status, 200); assert.match(invalid.headers.get('content-type'), /image\/gif/)
  await routes.openHead(request('open', token('open')))
  await routes.open(request('open', token('click', 'https://wishervodka.com/recipe')))
  assert.equal((await h.runtime.db.select().from(h.api.schema.activityEvents)).length, initial)
  const response = await routes.open(request('open', token('open')))
  assert.match(response.headers.get('cache-control'), /no-store/)
  assert.ok((await response.arrayBuffer()).byteLength > 0)
  await Promise.all(Array.from({ length: 4 }, () => routes.open(request('open', token('open')))))
  const metrics = (await h.api.getRecipeEmailEngagement([{ id: sendId, sentCount: 10 }])).get(sendId)
  assert.equal(metrics.opened, 1); assert.equal(metrics.openRate, 10)
})

test('click redirects preserve destination/UTM and deduplicate retries, with per-recipient timestamps', async () => {
  const url = 'https://wishervodka.com/recipe?utm_source=community&utm_medium=email'
  const valid = token('click', url)
  const head = await routes.clickHead(request('click', valid)); assert.equal(head.status, 302)
  assert.equal((await h.api.getRecipeEmailRecipientEngagement(sendId)).get(contactId).clickedAt, null)
  const response = await routes.click(request('click', valid))
  assert.equal(response.status, 302); assert.equal(response.headers.get('location'), url)
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer')
  await Promise.all(Array.from({ length: 4 }, () => routes.click(request('click', valid))))
  await routes.click(request('click', token('click', 'https://pstreetwines.com/')))
  const metrics = (await h.api.getRecipeEmailEngagement([{ id: sendId, sentCount: 10 }])).get(sendId)
  assert.equal(metrics.clicked, 1); assert.equal(metrics.engaged, 1); assert.equal(metrics.links.length, 2)
  const recipient = (await h.api.getRecipeEmailRecipientEngagement(sendId)).get(contactId)
  assert.ok(recipient.openedAt); assert.ok(recipient.clickedAt)
  const [send] = await h.runtime.db.select().from(h.api.schema.communityRecipeEmails).where(eq(h.api.schema.communityRecipeEmails.id, sendId))
  assert.equal(send.sentCount, 10); assert.equal(send.status, 'sent')
})

test('wrong-purpose and tampered click tokens never redirect; analytics outage does not break a valid link', async () => {
  assert.equal((await routes.click(request('click', token('open')))).status, 400)
  assert.equal((await routes.click(request('click', token('click', 'https://wishervodka.com/') + 'tampered'))).status, 400)
  const record = global.__recipeEngagementRecord, log = console.error
  global.__recipeEngagementRecord = async () => { throw new Error('Isolated analytics outage') }; console.error = () => {}
  try { assert.equal((await routes.click(request('click', token('click', 'https://wishervodka.com/')))).status, 302) }
  finally { global.__recipeEngagementRecord = record; console.error = log }
})

test('missing contacts or campaigns never create orphan analytics', async () => {
  const before = (await h.runtime.db.select().from(h.api.schema.activityEvents)).length
  await h.api.recordRecipeEmailEngagement({ sendId: randomUUID(), contactId, kind: 'open' })
  await h.api.recordRecipeEmailEngagement({ sendId, contactId: randomUUID(), kind: 'open' })
  assert.equal((await h.runtime.db.select().from(h.api.schema.activityEvents)).length, before)
})

