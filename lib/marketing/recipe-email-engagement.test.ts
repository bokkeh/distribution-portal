import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { calculateRecipeEngagement, aggregateRecipeEngagement, formatEngagementRate } from './recipe-email-engagement'
import { createRecipeTrackingToken, resolveRecipeTrackingToken, trackRecipeEmailContent } from './recipe-email-tracking-token'

process.env.COMMUNITY_EMAIL_SECRET = 'isolated-tracking-test-secret'
const sendId = randomUUID(), contactId = randomUUID()
const event = (kind: string, contactId: string, url?: string) => ({ kind: `recipe_email_${kind}`, metadata: { contactId, url }, createdAt: '2026-11-06T12:00:00Z' })
const marker = { kind: 'recipe_email_tracking_started', metadata: {}, createdAt: '2026-11-06T12:00:00Z' }

test('unknown historical engagement is distinct from tracked zero activity and zero denominators', () => {
  const old = calculateRecipeEngagement(10, [])
  assert.equal(old.tracked, false); assert.equal(old.openRate, null)
  const current = calculateRecipeEngagement(10, [marker])
  assert.equal(current.openRate, 0); assert.equal(current.clickRate, 0)
  assert.equal(calculateRecipeEngagement(0, [marker]).openRate, null)
  assert.equal(formatEngagementRate(null, false), 'Not tracked')
  assert.equal(formatEngagementRate(null), '—')
})

test('repeated opens/clicks and overlap do not inflate unique recipients or engagement', () => {
  const rows = [marker, event('opened', 'a'), event('opened', 'a'), event('clicked', 'a', 'https://wishervodka.com/recipe'), event('clicked', 'a', 'https://wishervodka.com/recipe'), event('clicked', 'a', 'https://pstreetwines.com/'), event('clicked', 'b', 'https://wishervodka.com/recipe')]
  const metrics = calculateRecipeEngagement(10, rows)
  assert.equal(metrics.opened, 1); assert.equal(metrics.clicked, 2); assert.equal(metrics.engaged, 2)
  assert.equal(metrics.openRate, 10); assert.equal(metrics.clickRate, 20); assert.equal(metrics.engagementRate, 20)
  assert.equal(metrics.clickToOpenRate, 100)
  assert.equal(metrics.links[0].recipients, 2)
})

test('summary rates are weighted by accepted recipients and exclude untracked historical sends', () => {
  const totals = aggregateRecipeEngagement([calculateRecipeEngagement(10, [marker, event('opened', 'a')]), calculateRecipeEngagement(90, [marker]), calculateRecipeEngagement(1000, [])])
  assert.equal(totals.openRate, 1); assert.equal(totals.sentCount, 100); assert.equal(totals.untrackedCampaigns, 1)
})

test('tracking tokens reject tampering, extra segments, wrong purposes and unsafe destinations', () => {
  const token = createRecipeTrackingToken({ sendId, contactId, kind: 'click', url: 'https://wishervodka.com/recipe?utm_source=email' })
  assert.equal(resolveRecipeTrackingToken(token)?.contactId, contactId)
  assert.equal(resolveRecipeTrackingToken(token + '.extra'), null)
  assert.equal(resolveRecipeTrackingToken(token.slice(0, -4) + 'abcd'), null)
  const [body, signature] = token.split('.')
  const changed = JSON.parse(Buffer.from(body, 'base64url').toString()); changed.url = 'https://evil.example/'
  assert.equal(resolveRecipeTrackingToken(Buffer.from(JSON.stringify(changed)).toString('base64url') + '.' + signature), null)
  for (const url of ['javascript:alert(1)', 'http://wishervodka.com/', 'https://user:pass@wishervodka.com/', 'https://portal.ahawc.com/api/community/unsubscribe?token=x']) assert.throws(() => createRecipeTrackingToken({ sendId, contactId, kind: 'click', url }))
})

test('HTML/plain-text marketing links are tracked without changing unsubscribe, headers, images or preview fragments', () => {
  const unsubscribe = 'https://portal.ahawc.com/api/community/unsubscribe?token=keep&w=2026-11-02'
  const content = { subject: 'Recipe', html: `<html><body><a href="https://wishervodka.com/recipe?a=1&amp;b=2">Recipe</a><a href="${unsubscribe}">Unsubscribe</a><a href="#">Preview</a><img src="https://wishervodka.com/logo.png" /></body></html>`, text: `Recipe https://wishervodka.com/recipe?a=1&b=2\nUnsubscribe ${unsubscribe}` }
  const tracked = trackRecipeEmailContent(content, { sendId, contactId, origin: 'https://portal.ahawc.com' })
  assert.equal(tracked.subject, content.subject)
  assert.ok(tracked.html.includes(`href="${unsubscribe}"`)); assert.ok(tracked.text.includes(unsubscribe))
  assert.ok(tracked.html.includes('api/community/email/open?token=')); assert.ok(tracked.text.includes('api/community/email/click?token='))
  assert.ok(tracked.html.includes('href="#"')); assert.ok(tracked.html.includes('src="https://wishervodka.com/logo.png"'))
  const token = tracked.html.match(/email\/click\?token=([^"]+)/)![1]
  assert.equal(resolveRecipeTrackingToken(token)?.url, 'https://wishervodka.com/recipe?a=1&b=2')
})

