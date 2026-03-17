'use client'

import { useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn, formatCurrency } from '@/lib/utils'
import { createPaymentIntent } from '@/actions/invoices'
import { useRouter } from 'next/navigation'
import { getCustomerPaymentBreakdown, type CustomerPaymentMethod } from '@/lib/stripe/fees'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '')

function InvoicePaymentForm({
  total,
  paymentMethod,
  onSuccess,
}: {
  total: string
  paymentMethod: CustomerPaymentMethod
  onSuccess: () => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements) return
    setLoading(true)
    setError('')

    const { error: stripeError } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}/customer/invoices` },
      redirect: 'if_required',
    })

    if (stripeError) {
      setError(stripeError.message ?? 'Payment failed')
      setLoading(false)
      return
    }
    onSuccess()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement options={{ paymentMethodOrder: [paymentMethod] }} />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={!stripe || loading} className="w-full">
        {loading ? 'Processing...' : `Pay ${formatCurrency(total)}`}
      </Button>
    </form>
  )
}

export default function InvoicePaymentClient({ invoiceId, total }: { invoiceId: string; total: string }) {
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<CustomerPaymentMethod>('us_bank_account')
  const [payableTotal, setPayableTotal] = useState(total)
  const [processingFee, setProcessingFee] = useState('0.00')
  const router = useRouter()
  const baseAmountCents = Math.round(Number(total) * 100)
  const cardBreakdown = getCustomerPaymentBreakdown(baseAmountCents, 'card')

  async function initPayment() {
    try {
      setLoading(true)
      const result = await createPaymentIntent(invoiceId, paymentMethod)
      setClientSecret(result.clientSecret!)
      setPayableTotal(result.amount)
      setProcessingFee(result.processingFee)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle>Pay Invoice</CardTitle></CardHeader>
      <CardContent>
        {!clientSecret ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Pay securely by bank transfer (ACH) or credit card via Stripe. Credit card payments include a Stripe processing fee paid by the customer.</p>
            <div className="grid gap-2">
              {([
                {
                  value: 'us_bank_account',
                  title: 'Bank transfer (ACH)',
                  description: 'No processing fee added.',
                  totalLabel: formatCurrency(total),
                },
                {
                  value: 'card',
                  title: 'Credit card',
                  description: `Includes a ${formatCurrency(cardBreakdown.processingFee)} Stripe processing fee.`,
                  totalLabel: formatCurrency(cardBreakdown.totalAmount),
                },
              ] as const).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setPaymentMethod(option.value)}
                  className={cn(
                    'rounded-lg border p-3 text-left transition',
                    paymentMethod === option.value ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:border-slate-300',
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{option.title}</p>
                      <p className="text-xs text-muted-foreground">{option.description}</p>
                    </div>
                    <div className="text-sm font-semibold text-slate-900">{option.totalLabel}</div>
                  </div>
                </button>
              ))}
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
              <div className="flex justify-between">
                <span>Invoice total</span>
                <span>{formatCurrency(total)}</span>
              </div>
              <div className="mt-1 flex justify-between">
                <span>Card processing fee</span>
                <span>{paymentMethod === 'card' ? formatCurrency(cardBreakdown.processingFee) : formatCurrency(0)}</span>
              </div>
              <div className="mt-2 flex justify-between font-semibold text-slate-900">
                <span>Total due now</span>
                <span>{paymentMethod === 'card' ? formatCurrency(cardBreakdown.totalAmount) : formatCurrency(total)}</span>
              </div>
            </div>
            <Button className="w-full" onClick={initPayment} disabled={loading}>
              {loading ? 'Preparing...' : `Continue to ${paymentMethod === 'card' ? 'Card Payment' : 'ACH Payment'}`}
            </Button>
          </div>
        ) : (
          <Elements stripe={stripePromise} options={{ clientSecret }}>
            <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
              <div className="flex justify-between">
                <span>Invoice total</span>
                <span>{formatCurrency(total)}</span>
              </div>
              <div className="mt-1 flex justify-between">
                <span>Card processing fee</span>
                <span>{paymentMethod === 'card' ? formatCurrency(processingFee) : formatCurrency(0)}</span>
              </div>
              <div className="mt-2 flex justify-between font-semibold text-slate-900">
                <span>Total being charged</span>
                <span>{formatCurrency(payableTotal)}</span>
              </div>
            </div>
            <InvoicePaymentForm total={payableTotal} paymentMethod={paymentMethod} onSuccess={() => router.push('/customer/invoices')} />
          </Elements>
        )}
      </CardContent>
    </Card>
  )
}
