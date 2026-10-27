import assert from 'node:assert/strict'
import test from 'node:test'
import { validateRecipeEmailConfig } from './recipe-email-config'

const valid = {
  RESEND_API_KEY: 'test', RESEND_WEBHOOK_SECRET: 'test', COMMUNITY_EMAIL_SECRET: 'test',
  COMMUNITY_EMAIL_FROM: 'Wisher <cheers@example.com>', COMMUNITY_EMAIL_REPLY_TO: 'support@example.com',
  COMMUNITY_EMAIL_MAILING_ADDRESS: '123 Example St, Example City, TX 75001', NEXTAUTH_URL: 'https://portal.example.com',
}

test('accepts complete sending configuration', () => assert.doesNotThrow(() => validateRecipeEmailConfig(valid)))
test('retains the existing configured sender when no recipe-specific override is set', () => {
  assert.doesNotThrow(() => validateRecipeEmailConfig({ ...valid, COMMUNITY_EMAIL_FROM: undefined, RESEND_FROM_EMAIL: 'sender@example.com' }))
})
test('rejects missing required sending and unsubscribe settings', () => {
  for (const key of Object.keys(valid).filter(key => key !== 'NEXTAUTH_URL')) {
    assert.throws(() => validateRecipeEmailConfig({ ...valid, [key]: ' ' }), key)
  }
})
test('rejects insecure or malformed unsubscribe origins', () => {
  for (const NEXTAUTH_URL of ['http://portal.example.com', 'https://localhost', 'https://127.0.0.1', 'https://portal.example.com/path', 'https://user:pass@portal.example.com', 'https://portal.example.com?x=1']) {
    assert.throws(() => validateRecipeEmailConfig({ ...valid, NEXTAUTH_URL }))
  }
})
test('rejects malformed sender and reply addresses', () => {
  for (const key of ['COMMUNITY_EMAIL_FROM', 'COMMUNITY_EMAIL_REPLY_TO']) {
    assert.throws(() => validateRecipeEmailConfig({ ...valid, [key]: 'invalid' }))
    assert.throws(() => validateRecipeEmailConfig({ ...valid, [key]: 'a@example.com\r\nBcc: other@example.com' }))
  }
})
