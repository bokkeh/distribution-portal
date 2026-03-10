'use client'

import { useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'
import { createPaymentIntent } from '@/actions/invoices'
import { useRouter } from 'next/navigation'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '')

function InvoicePaymentForm({ total, onSuccess }: { total: string; onSuccess: () => void }) {
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
      <PaymentElement options={{ paymentMethodOrder: ['us_bank_account', 'card'] }} />
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
  const router = useRouter()

  async function initPayment() {
    setLoading(true)
    const { clientSecret } = await createPaymentIntent(invoiceId)
    setClientSecret(clientSecret!)
    setLoading(false)
  }

  return (
    <Card>
      <CardHeader><CardTitle>Pay Invoice</CardTitle></CardHeader>
      <CardContent>
        {!clientSecret ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Pay securely by bank transfer (ACH) or credit/debit card via Stripe.</p>
            <Button className="w-full" onClick={initPayment} disabled={loading}>
              {loading ? 'Preparing...' : `Pay ${formatCurrency(total)} Now`}
            </Button>
          </div>
        ) : (
          <Elements stripe={stripePromise} options={{ clientSecret }}>
            <InvoicePaymentForm total={total} onSuccess={() => router.push('/customer/invoices')} />
          </Elements>
        )}
      </CardContent>
    </Card>
  )
}
