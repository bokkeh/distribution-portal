'use client'

import { useRef, useState } from 'react'
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'
import { startFieldCardPayment } from '@/actions/field-documents'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ''
const stripePromise = publishableKey ? loadStripe(publishableKey) : null

function CardForm({ requestId, amount }: { requestId: string; amount: string }) {
  const stripe = useStripe(), elements = useElements()
  const locked = useRef(false)
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState('')
  const [submitted, setSubmitted] = useState(false)
  return <form className="space-y-4" onSubmit={async event => {
    event.preventDefault()
    if (!stripe || !elements || locked.current) return
    locked.current = true; setPending(true); setMessage('')
    try {
      const result = await stripe.confirmPayment({ elements, confirmParams: { return_url: `${window.location.origin}/field?invoice=${requestId}` }, redirect: 'if_required' })
      if (result.error) { setMessage(result.error.message ?? 'Payment failed. Check the card details and retry.'); return }
      if (result.paymentIntent?.status === 'succeeded' || result.paymentIntent?.status === 'processing') {
        setSubmitted(true)
        setMessage(result.paymentIntent.status === 'succeeded' ? 'Stripe confirmed payment. The invoice will update when the portal receives confirmation.' : 'Payment is processing. Do not charge again; check the invoice status.')
      } else setMessage('Stripe still requires payment confirmation. Follow the displayed instructions or check the invoice before retrying.')
    } catch { setMessage('Payment could not be confirmed. Check the invoice status before retrying to avoid another charge.') }
    finally { locked.current = false; setPending(false) }
  }}>
    <PaymentElement />
    <label className="flex items-start gap-3 rounded-xl bg-stone-50 p-3 text-sm"><input type="checkbox" required className="mt-1 size-5" />The customer authorizes this card payment and has reviewed the total, including the processing fee.</label>
    {message ? <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm">{message}</p> : null}
    <Button className="h-14 w-full text-base" disabled={!stripe || pending || submitted}>{pending ? 'Confirming payment…' : submitted ? 'Payment submitted' : `Pay ${formatCurrency(amount)} securely`}</Button>
  </form>
}

export function FieldCardPayment({ requestId }: { requestId: string }) {
  const locked = useRef(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [payment, setPayment] = useState<{ clientSecret: string; amount: string; processingFee: string } | null>(null)
  if (!stripePromise) return <p role="alert">Card entry is unavailable because Stripe is not configured. Use the invoice’s secure payment link or contact an administrator.</p>
  return <section className="space-y-4 rounded-2xl border bg-white p-4">
    <h3 className="text-lg font-semibold">Customer card payment</h3>
    <p className="text-sm text-muted-foreground">With the customer’s authorization, enter their card in Stripe’s secure fields.</p>
    {error ? <p role="alert" className="text-red-700">{error}</p> : null}
    {!payment ? <Button className="h-14 w-full text-base" disabled={pending} onClick={async () => {
      if (locked.current) return
      locked.current = true; setPending(true); setError('')
      try { const result = await startFieldCardPayment(requestId); if (!result.clientSecret) throw new Error('Stripe did not return a payment form.'); setPayment({ ...result, clientSecret: result.clientSecret }) }
      catch (error) { setError(error instanceof Error ? error.message : 'Could not prepare card entry. Retry.') }
      finally { locked.current = false; setPending(false) }
    }}>{pending ? 'Preparing secure card entry…' : 'Open secure card entry'}</Button> : <>
      <p className="rounded-xl bg-stone-50 p-3 text-sm">Total charge: <strong>{formatCurrency(payment.amount)}</strong> · Includes {formatCurrency(payment.processingFee)} card processing fee.</p>
      <Elements stripe={stripePromise} options={{ clientSecret: payment.clientSecret, appearance: { variables: { colorPrimary: '#ff5a00', borderRadius: '12px', fontSizeBase: '16px' } } }}><CardForm requestId={requestId} amount={payment.amount} /></Elements>
    </>}
  </section>
}
