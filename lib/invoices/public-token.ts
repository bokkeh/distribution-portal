import { createHmac, timingSafeEqual } from 'crypto'

function getInvoiceTokenSecret() {
  return process.env.INVOICE_PUBLIC_LINK_SECRET || process.env.NEXTAUTH_SECRET || 'invoice-public-link-secret'
}

function signInvoiceId(invoiceId: string) {
  return createHmac('sha256', getInvoiceTokenSecret()).update(invoiceId).digest('base64url')
}

export function createInvoicePublicToken(invoiceId: string) {
  return `${invoiceId}.${signInvoiceId(invoiceId)}`
}

export function getInvoicePublicPaymentPath(invoiceId: string) {
  return `/pay/${createInvoicePublicToken(invoiceId)}`
}

export function resolveInvoiceIdFromPublicToken(token: string) {
  const [invoiceId, signature] = token.split('.')
  if (!invoiceId || !signature) return null

  const expected = signInvoiceId(invoiceId)
  const provided = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expected)

  if (provided.length !== expectedBuffer.length) return null
  if (!timingSafeEqual(provided, expectedBuffer)) return null

  return invoiceId
}
