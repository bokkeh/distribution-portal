import assert from 'node:assert/strict'
import test from 'node:test'
import { createRepAssistedAccessToken, hashRepAssistedAccessToken } from '../lib/orders/rep-assisted-token'

test('rep-assisted links use opaque random tokens and stable one-way hashes', () => {
  const first = createRepAssistedAccessToken()
  const second = createRepAssistedAccessToken()
  assert.notEqual(first.token, second.token)
  assert.notEqual(first.hash, second.hash)
  assert.equal(first.hash, hashRepAssistedAccessToken(first.token))
  assert.equal(first.hash.length, 64)
  assert.equal(first.token.includes('.'), false)
})

test('changing a secure token invalidates its hash', () => {
  const { token, hash } = createRepAssistedAccessToken()
  assert.notEqual(hashRepAssistedAccessToken(`${token}x`), hash)
})
