export function isMissingShippingStatusColumn(error: unknown) {
  const dbError = error as { code?: string; message?: string; cause?: unknown } | null
  const code = dbError?.code ?? (dbError?.cause as { code?: string } | undefined)?.code
  const message = error instanceof Error ? error.message.toLowerCase() : ''

  return code === '42703' || message.includes('shipping_status') || message.includes('payment_status')
}
