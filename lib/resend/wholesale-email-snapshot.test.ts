import assert from 'node:assert/strict'
import test from 'node:test'
import { wholesaleEmailSnapshot } from './wholesale-email-snapshot'

test('saves the sent content while removing every occurrence of a private activation URL', () => {
  const privateUrl = 'https://portal.example.com/customer-activate?token=secret'
  const snapshot = wholesaleEmailSnapshot({ to: ['buyer@example.com'], from: 'sender@example.com', subject: 'Activate your account', html: `<a href="${privateUrl}">Set Up Portal Access</a><p>${privateUrl}</p>`, privateUrl, status: 'sent' })
  assert.equal(snapshot.html.includes('secret'), false)
  assert.equal(snapshot.html, '<a href="#activation-link-hidden">Set Up Portal Access</a><p>#activation-link-hidden</p>')
  assert.equal(snapshot.activationLinkHidden, true)
  assert.deepEqual(snapshot.to, ['buyer@example.com'])
})

test('preserves ready email content and failed-send status', () => {
  const snapshot = wholesaleEmailSnapshot({ to: ['buyer@example.com'], from: 'sender@example.com', subject: 'Portal ready', html: '<p>Sign in with your existing password.</p>', status: 'failed' })
  assert.equal(snapshot.status, 'failed')
  assert.equal(snapshot.html, '<p>Sign in with your existing password.</p>')
  assert.equal(snapshot.activationLinkHidden, false)
})
