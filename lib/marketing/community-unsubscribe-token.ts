import { createHmac, timingSafeEqual } from 'crypto'

function getSecret() {
  const secret = (process.env.COMMUNITY_EMAIL_SECRET ?? process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET)?.trim()
  if (!secret) throw new Error('COMMUNITY_EMAIL_SECRET (or NEXTAUTH_SECRET) is required to sign unsubscribe links.')
  return secret
}

function signContactId(contactId: string) {
  return createHmac('sha256', getSecret()).update(`community-unsubscribe:${contactId}`).digest('base64url')
}

export function createCommunityUnsubscribeToken(contactId: string) {
  return `${contactId}.${signContactId(contactId)}`
}

export function resolveContactIdFromUnsubscribeToken(token: string) {
  const [contactId, signature] = token.split('.')
  if (!contactId || !signature) return null

  const provided = Buffer.from(signature)
  const expected = Buffer.from(signContactId(contactId))
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return null

  return contactId
}
