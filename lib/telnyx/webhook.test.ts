import assert from 'node:assert/strict'
import { generateKeyPairSync, sign } from 'node:crypto'
import { test } from 'node:test'
import { verifyTelnyxWebhookSignature } from './webhook'

test('validates signed delivery callbacks and rejects tampered or stale receipts', async () => {
  const previous = process.env.TELNYX_WEBHOOK_PUBLIC_KEY
  const { publicKey, privateKey } = generateKeyPairSync('ed25519')
  process.env.TELNYX_WEBHOOK_PUBLIC_KEY = publicKey.export({ type: 'spki', format: 'pem' }).toString()
  try {
    const payload = JSON.stringify({ data: { event_type: 'message.finalized', payload: { id: 'message-1', to: [{ phone_number: '+15555550101', status: 'delivered' }] } } })
    const timestamp = String(Math.floor(Date.now() / 1000))
    const signature = sign(null, Buffer.from(`${timestamp}|${payload}`), privateKey).toString('base64')
    assert.equal(await verifyTelnyxWebhookSignature({ payload, timestampHeader: timestamp, signatureHeader: signature }), true)
    assert.equal(await verifyTelnyxWebhookSignature({ payload: `${payload} `, timestampHeader: timestamp, signatureHeader: signature }), false)
    assert.equal(await verifyTelnyxWebhookSignature({ payload, timestampHeader: String(Number(timestamp) - 600), signatureHeader: signature }), false)
    assert.equal(await verifyTelnyxWebhookSignature({ payload, timestampHeader: timestamp, signatureHeader: null }), false)
  } finally {
    if (previous === undefined) delete process.env.TELNYX_WEBHOOK_PUBLIC_KEY
    else process.env.TELNYX_WEBHOOK_PUBLIC_KEY = previous
  }
})
