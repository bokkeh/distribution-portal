import { createPublicKey, verify, webcrypto } from 'crypto'

const MAX_SIGNATURE_AGE_MS = 5 * 60 * 1000
const TELNYX_PUBLIC_KEY_ENV = 'TELNYX_WEBHOOK_PUBLIC_KEY'

function normalizeValue(value: string | undefined) {
  if (!value) return ''

  let normalized = value.trim()
  if (
    (normalized.startsWith('"') && normalized.endsWith('"')) ||
    (normalized.startsWith("'") && normalized.endsWith("'"))
  ) {
    normalized = normalized.slice(1, -1)
  }

  return normalized.trim()
}

function decodeMaybeHexOrBase64(value: string) {
  const normalized = normalizeValue(value)
  if (!normalized) return null

  if (/^[0-9a-f]+$/i.test(normalized) && normalized.length % 2 === 0) {
    return Buffer.from(normalized, 'hex')
  }

  const base64 = normalized.replace(/-/g, '+').replace(/_/g, '/')
  const padded = `${base64}${'='.repeat((4 - (base64.length % 4)) % 4)}`

  try {
    return Buffer.from(padded, 'base64')
  } catch {
    return null
  }
}

function getTelnyxWebhookPublicKey() {
  return normalizeValue(process.env[TELNYX_PUBLIC_KEY_ENV])
}

function isSignatureFresh(timestampHeader: string) {
  const unixSeconds = Number(timestampHeader)
  if (!Number.isFinite(unixSeconds)) return false

  const ageMs = Math.abs(Date.now() - (unixSeconds * 1000))
  return ageMs <= MAX_SIGNATURE_AGE_MS
}

async function verifyWithRawEd25519Key(
  publicKeyBytes: Buffer,
  signature: Buffer,
  payload: Buffer,
) {
  const cryptoKey = await webcrypto.subtle.importKey(
    'raw',
    publicKeyBytes,
    { name: 'Ed25519' },
    false,
    ['verify'],
  )

  return webcrypto.subtle.verify('Ed25519', cryptoKey, signature, payload)
}

export function isTelnyxWebhookVerificationConfigured() {
  return Boolean(getTelnyxWebhookPublicKey())
}

export async function verifyTelnyxWebhookSignature(input: {
  payload: string
  signatureHeader: string | null
  timestampHeader: string | null
}) {
  const publicKey = getTelnyxWebhookPublicKey()
  if (!publicKey) return false
  if (!input.signatureHeader || !input.timestampHeader) return false
  if (!isSignatureFresh(input.timestampHeader)) return false

  const signedPayload = Buffer.from(`${input.timestampHeader}|${input.payload}`, 'utf8')
  const signature = decodeMaybeHexOrBase64(input.signatureHeader)
  if (!signature) return false

  if (publicKey.includes('BEGIN PUBLIC KEY')) {
    return verify(null, signedPayload, createPublicKey(publicKey), signature)
  }

  const publicKeyBytes = decodeMaybeHexOrBase64(publicKey)
  if (!publicKeyBytes) return false

  if (publicKeyBytes.length === 32) {
    return verifyWithRawEd25519Key(publicKeyBytes, signature, signedPayload)
  }

  return verify(
    null,
    signedPayload,
    createPublicKey({ key: publicKeyBytes, format: 'der', type: 'spki' }),
    signature,
  )
}

