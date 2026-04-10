import { createHmac, timingSafeEqual } from 'crypto'

function getInvoiceTokenSecret() {
  const secret = process.env.INVOICE_PUBLIC_LINK_SECRET?.trim()
  return secret ? secret : null
}

function signInvoiceId(invoiceId: string) {
  const secret = getInvoiceTokenSecret()
  if (!secret) {
    throw new Error('INVOICE_PUBLIC_LINK_SECRET is required to create invoice payment tokens.')
  }

  return createHmac('sha256', secret).update(invoiceId).digest('base64url')
}

export function createInvoicePublicToken(invoiceId: string) {
  return `${invoiceId}.${signInvoiceId(invoiceId)}`
}

export function getInvoicePublicPaymentPath(invoiceId: string) {
  return `/pay/${createInvoicePublicToken(invoiceId)}`
}

export function resolveInvoiceIdFromPublicToken(token: string) {
  if (!getInvoiceTokenSecret()) return null

  const [invoiceId, signature] = token.split('.')
  if (!invoiceId || !signature) return null

  const expected = signInvoiceId(invoiceId)
  const provided = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expected)

  if (provided.length !== expectedBuffer.length) return null
  if (!timingSafeEqual(provided, expectedBuffer)) return null

  return invoiceId
}
