export type CustomerPaymentMethod = 'us_bank_account' | 'card'

const CARD_RATE = 0.029
const CARD_FIXED_FEE_CENTS = 30

function centsToDollars(cents: number) {
  return (cents / 100).toFixed(2)
}

export function calculateCardProcessingFeeCents(baseAmountCents: number) {
  if (!Number.isFinite(baseAmountCents) || baseAmountCents <= 0) return 0
  return Math.max(
    0,
    Math.ceil((baseAmountCents * CARD_RATE + CARD_FIXED_FEE_CENTS) / (1 - CARD_RATE)),
  )
}

export function getCustomerPaymentBreakdown(baseAmountCents: number, method: CustomerPaymentMethod) {
  const processingFeeCents = method === 'card' ? calculateCardProcessingFeeCents(baseAmountCents) : 0
  const totalAmountCents = baseAmountCents + processingFeeCents

  return {
    method,
    baseAmountCents,
    processingFeeCents,
    totalAmountCents,
    baseAmount: centsToDollars(baseAmountCents),
    processingFee: centsToDollars(processingFeeCents),
    totalAmount: centsToDollars(totalAmountCents),
  }
}
