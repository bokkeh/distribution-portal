'use client'

import { useState } from 'react'
import { useCart } from '@/hooks/useCart'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { createOrder } from '@/actions/orders'
import { useRouter } from 'next/navigation'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '')

function PaymentForm({ customerId, orderType, items, total, onSuccess }: {
  customerId: string
  orderType: 'paid' | 'sample'
  items: any[]
  total: number
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
      confirmParams: { return_url: `${window.location.origin}/customer/orders` },
      redirect: 'if_required',
    })

    if (stripeError) {
      setError(stripeError.message ?? 'Payment failed')
      setLoading(false)
      return
    }

    // Place the order after successful payment
    const formData = new FormData()
    formData.append('customerId', customerId)
    formData.append('orderType', orderType)
    formData.append('items', JSON.stringify(items.map(i => ({ productId: i.productId, quantity: i.quantity }))))
    await createOrder(formData)
    onSuccess()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={!stripe || loading} className="w-full">
        {loading ? 'Processing...' : `Pay ${formatCurrency(total)}`}
      </Button>
    </form>
  )
}

export default function CheckoutClient({ customerId, customerName }: { customerId: string; customerName: string }) {
  const { items, orderType, total, clearCart } = useCart()
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function initializePayment() {
    setLoading(true)
    const res = await fetch('/api/stripe/payment-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: Math.round(total() * 100), customerId }),
    })
    const { clientSecret } = await res.json()
    setClientSecret(clientSecret)
    setLoading(false)
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Your cart is empty.</p>
        <Button className="mt-4" onClick={() => router.push('/customer/products')}>Browse Products</Button>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Order Summary */}
      <Card>
        <CardHeader><CardTitle>Order Summary</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">Customer: {customerName}</p>
          <p className="text-sm text-muted-foreground">Order Type: <strong>{orderType}</strong></p>
          <div className="space-y-2 border-t pt-3">
            {items.map(item => {
              const price = parseFloat(orderType === 'sample' ? item.samplePrice : item.price)
              return (
                <div key={item.productId} className="flex justify-between text-sm">
                  <span>{item.name} ×{item.quantity}</span>
                  <span>{formatCurrency(price * item.quantity)}</span>
                </div>
              )
            })}
          </div>
          <div className="border-t pt-3 flex justify-between font-bold text-lg">
            <span>Total</span><span>{formatCurrency(total())}</span>
          </div>
        </CardContent>
      </Card>

      {/* Payment */}
      <Card>
        <CardHeader><CardTitle>Payment</CardTitle></CardHeader>
        <CardContent>
          {!clientSecret ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Secure payment powered by Stripe. Your card details are never stored on our servers.
              </p>
              <Button className="w-full" onClick={initializePayment} disabled={loading}>
                {loading ? 'Preparing...' : 'Proceed to Payment'}
              </Button>
              <p className="text-xs text-center text-muted-foreground">Test card: 4242 4242 4242 4242</p>
            </div>
          ) : (
            <Elements stripe={stripePromise} options={{ clientSecret }}>
              <PaymentForm
                customerId={customerId}
                orderType={orderType}
                items={items}
                total={total()}
                onSuccess={() => { clearCart(); router.push('/customer/orders') }}
              />
            </Elements>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
