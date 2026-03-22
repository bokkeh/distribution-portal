export const PAYMENT_TERM_OPTIONS = [
  { value: 'PREPAID', label: 'Prepaid' },
  { value: 'DUE_ON_RECEIPT', label: 'Due on Receipt' },
  { value: 'NET7', label: 'Net 7' },
  { value: 'NET10', label: 'Net 10' },
  { value: 'NET15', label: 'Net 15' },
  { value: 'NET30', label: 'Net 30' },
  { value: 'NET45', label: 'Net 45' },
  { value: 'NET60', label: 'Net 60' },
  { value: 'NET90', label: 'Net 90' },
  { value: 'COD', label: 'COD (Cash on Delivery)' },
  { value: '2/10_NET30', label: '2/10 Net 30 (Early Pay Discount)' },
] as const

export const PAYMENT_TERMS_LABELS = Object.fromEntries(
  PAYMENT_TERM_OPTIONS.map((option) => [option.value, option.label]),
) as Record<string, string>

export function formatPaymentTerms(terms: string | null | undefined) {
  if (!terms) return 'Net 30'
  return PAYMENT_TERMS_LABELS[terms] ?? terms
}
