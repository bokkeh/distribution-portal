'use client'

import { useMemo, useState } from 'react'
import { useCart } from '@/hooks/useCart'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn, formatCurrency } from '@/lib/utils'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { createOrder } from '@/actions/orders'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { getMinimumCaseQuantity, isWisherVodkaProduct } from '@/lib/orders/minimums'
import { getCustomerPaymentBreakdown, type CustomerPaymentMethod } from '@/lib/stripe/fees'
import { resolveGeographicCasePrice, type GeographicPricingRuleInput } from '@/lib/pricing/geographic'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '')

function getDisplayedPrice(
  item: { productId: string; price: string; samplePrice: string; quantity: number },
  orderType: 'paid' | 'sample',
  pricingRules: GeographicPricingRuleInput[],
  pricingAccountId: string | null,
  pricingBusinessType: string | null,
  pricingState: string | null,
  pricingCounty: string | null
) {
  if (orderType === 'sample') return parseFloat(item.samplePrice)
  return resolveGeographicCasePrice({
    productId: item.productId,
    baseCasePrice: item.price,
    accountId: pricingAccountId,
    businessType: pricingBusinessType,
    state: pricingState,
    county: pricingCounty,
    rules: pricingRules,
    asOf: new Date(),
    quantityCases: item.quantity,
  }).price
}

function PaymentForm({ customerId, orderType, items, total, notes, deliveryTiming, preferredDeliveryDay, preferredDeliveryTime, deliveryRequirements, paymentMethod, processingFee, paymentIntentId, onSuccess }: {
  customerId: string
  orderType: 'paid' | 'sample'
  items: Array<{ productId: string; quantity: number }>
  total: number
  notes: string
  deliveryTiming: 'standard' | 'time_sensitive'
  preferredDeliveryDay: string
  preferredDeliveryTime: string
  deliveryRequirements: string
  paymentMethod: CustomerPaymentMethod
  processingFee: number
  paymentIntentId: string
  onSuccess: (redirectTo?: string) => void
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
      toast.error('Payment failed', { description: stripeError.message ?? 'Stripe could not process the payment.' })
      setLoading(false)
      return
    }

    const formData = new FormData()
    formData.append('customerId', customerId)
    formData.append('orderType', orderType)
    formData.append('items', JSON.stringify(items.map(i => ({ productId: i.productId, quantity: i.quantity }))))
    if (notes.trim()) formData.append('notes', notes.trim())
    if (deliveryTiming) formData.append('deliveryTiming', deliveryTiming)
    if (preferredDeliveryDay) formData.append('preferredDeliveryDay', preferredDeliveryDay)
    if (preferredDeliveryTime) formData.append('preferredDeliveryTime', preferredDeliveryTime)
    if (deliveryRequirements) formData.append('deliveryRequirements', deliveryRequirements)
    formData.append('paymentMethod', paymentMethod)
    formData.append('processingFee', processingFee.toFixed(2))
    formData.append('paymentIntentId', paymentIntentId)
    const result = await createOrder(formData)
    if (result?.error) {
      setError(result.error)
      toast.error('Order placement failed', { description: result.error })
      setLoading(false)
      return
    }
    toast.success(
      result?.paymentStatus === 'processing' ? 'Order received, payment processing' : 'Order placed',
      {
        description: result?.paymentStatus === 'processing'
          ? 'Stripe is still confirming the payment. The order is saved and will update when payment clears.'
          : undefined,
      },
    )
    onSuccess(result?.redirectTo)
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

export default function CheckoutClient({
  customerId,
  customerName,
  businessType,
  pricingRules,
  pricingAccountId,
  pricingBusinessType,
  pricingState,
  pricingCounty,
}: {
  customerId: string
  customerName: string
  businessType?: string | null
  pricingRules: GeographicPricingRuleInput[]
  pricingAccountId: string | null
  pricingBusinessType: string | null
  pricingState: string | null
  pricingCounty: string | null
}) {
  const { items, orderType, clearCart } = useCart()
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [notes, setNotes] = useState('')
  const [deliveryTiming, setDeliveryTiming] = useState<'standard' | 'time_sensitive'>('standard')
  const [preferredDeliveryDay, setPreferredDeliveryDay] = useState('')
  const [preferredDeliveryTime, setPreferredDeliveryTime] = useState('')
  const [deliveryRequirements, setDeliveryRequirements] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<CustomerPaymentMethod>('us_bank_account')
  const [payableTotal, setPayableTotal] = useState(0)
  const [processingFee, setProcessingFee] = useState(0)
  const router = useRouter()

  const minimumViolation = useMemo(
    () => items.find(item => isWisherVodkaProduct(item) && item.quantity < getMinimumCaseQuantity(item, businessType)),
    [items, businessType]
  )

  async function initializePayment() {
    if (minimumViolation) {
      toast.error('Minimum order not met', {
        description: `${minimumViolation.name} requires at least ${getMinimumCaseQuantity(minimumViolation, businessType)} cases.`,
      })
      return
    }

    try {
      setLoading(true)
      const res = await fetch('/api/stripe/payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          orderType,
          items: items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
          deliveryTiming,
          preferredDeliveryDay,
          paymentMethod,
        }),
      })
      if (!res.ok) {
        const payload = await res.json().catch(() => null)
        throw new Error(typeof payload?.error === 'string' ? payload.error : 'Unable to initialize Stripe payment')
      }
      const { clientSecret, amount, processingFee, paymentIntentId } = await res.json()
      if (!clientSecret) throw new Error('Missing Stripe client secret')
      if (!paymentIntentId) throw new Error('Missing Stripe payment intent id')
      setClientSecret(clientSecret)
      setPayableTotal(Number(amount))
      setProcessingFee(Number(processingFee))
      setPaymentIntentId(paymentIntentId)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to initialize payment'
      toast.error('Payment setup failed', { description: message })
    } finally {
      setLoading(false)
    }
  }

  const totalAmount = items.reduce((sum, item) => sum + getDisplayedPrice(item, orderType, pricingRules, pricingAccountId, pricingBusinessType, pricingState, pricingCounty) * item.quantity, 0)
  const timeSensitiveFee =
    deliveryTiming === 'time_sensitive'
      ? (preferredDeliveryDay && ['saturday', 'sunday'].includes(preferredDeliveryDay.toLowerCase()) ? 50 : 30)
      : 0
  const orderAmountWithDelivery = totalAmount + timeSensitiveFee
  const achBreakdown = getCustomerPaymentBreakdown(Math.round(orderAmountWithDelivery * 100), 'us_bank_account')
  const cardBreakdown = getCustomerPaymentBreakdown(Math.round(orderAmountWithDelivery * 100), 'card')

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
      <Card>
        <CardHeader><CardTitle>Order Summary</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">Customer: {customerName}</p>
          <p className="text-sm text-muted-foreground">Order Type: <strong>{orderType}</strong></p>
          {minimumViolation && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {minimumViolation.name} requires a minimum of {getMinimumCaseQuantity(minimumViolation, businessType)} cases before checkout.
            </div>
          )}
          <div className="space-y-2 border-t pt-3">
            {items.map(item => {
              const price = getDisplayedPrice(item, orderType, pricingRules, pricingAccountId, pricingBusinessType, pricingState, pricingCounty)
              return (
                <div key={item.productId} className="flex justify-between text-sm">
                  <span>{item.name} x{item.quantity}</span>
                  <span>{formatCurrency(price * item.quantity)}</span>
                </div>
              )
            })}
          </div>
          <div className="border-t pt-3 flex justify-between font-bold text-lg">
            <span>Total</span><span>{formatCurrency(totalAmount)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Delivery fee</span><span>{formatCurrency(timeSensitiveFee)}</span>
          </div>
          <div className="border-t pt-3 flex justify-between font-bold text-lg">
            <span>Total with delivery</span><span>{formatCurrency(orderAmountWithDelivery)}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Payment</CardTitle></CardHeader>
        <CardContent>
          {!clientSecret ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Secure payment powered by Stripe. Your card details are never stored on our servers.
              </p>
              <div className="space-y-1.5">
                <label htmlFor="deliveryTiming" className="text-sm font-medium text-slate-900">
                  Delivery option
                </label>
                <select
                  id="deliveryTiming"
                  value={deliveryTiming}
                  onChange={(e) => setDeliveryTiming(e.target.value as 'standard' | 'time_sensitive')}
                  className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm"
                >
                  <option value="standard">Standard delivery within 2 weeks</option>
                  <option value="time_sensitive">Time-sensitive delivery</option>
                </select>
                <p className="text-xs text-muted-foreground">
                  Time-sensitive orders add a $30 weekday fee or $50 weekend fee.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <label htmlFor="preferredDeliveryDay" className="text-sm font-medium text-slate-900">
                    Preferred delivery day
                  </label>
                  <select
                    id="preferredDeliveryDay"
                    value={preferredDeliveryDay}
                    onChange={(e) => setPreferredDeliveryDay(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm"
                  >
                    <option value="">Select a day</option>
                    <option value="Monday">Monday</option>
                    <option value="Tuesday">Tuesday</option>
                    <option value="Wednesday">Wednesday</option>
                    <option value="Thursday">Thursday</option>
                    <option value="Friday">Friday</option>
                    <option value="Saturday">Saturday</option>
                    <option value="Sunday">Sunday</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="preferredDeliveryTime" className="text-sm font-medium text-slate-900">
                    Preferred delivery time
                  </label>
                  <Input
                    id="preferredDeliveryTime"
                    value={preferredDeliveryTime}
                    onChange={(e) => setPreferredDeliveryTime(e.target.value)}
                    placeholder="e.g. 9am-12pm"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="deliveryRequirements" className="text-sm font-medium text-slate-900">
                  Delivery requirements
                </label>
                <textarea
                  id="deliveryRequirements"
                  value={deliveryRequirements}
                  onChange={(e) => setDeliveryRequirements(e.target.value)}
                  placeholder="Loading dock details, contact requests, or special handling."
                  rows={3}
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="order-notes" className="text-sm font-medium text-slate-900">
                  Order Notes <span className="font-normal text-muted-foreground">(optional)</span>
                </label>
                <textarea
                  id="order-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Expedited delivery needed, leave with John, ring doorbell, etc."
                  rows={3}
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-900">Choose payment method</p>
                {([
                  {
                    value: 'us_bank_account',
                    title: 'Bank transfer (ACH)',
                    description: `Customer pays ${formatCurrency(achBreakdown.processingFee)} Stripe ACH fee.`,
                    totalLabel: formatCurrency(achBreakdown.totalAmount),
                  },
                  {
                    value: 'card',
                    title: 'Credit card',
                    description: `Customer pays ${formatCurrency(cardBreakdown.processingFee)} Stripe fee.`,
                    totalLabel: formatCurrency(cardBreakdown.totalAmount),
                  },
                ] as const).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setPaymentMethod(option.value)}
                    className={cn(
                      'w-full rounded-lg border p-3 text-left transition',
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
                  <span>Order subtotal</span>
                  <span>{formatCurrency(totalAmount)}</span>
                </div>
                <div className="mt-1 flex justify-between">
                  <span>Delivery fee</span>
                  <span>{formatCurrency(timeSensitiveFee)}</span>
                </div>
                <div className="mt-1 flex justify-between">
                  <span>Stripe processing fee</span>
                  <span>{paymentMethod === 'card' ? formatCurrency(cardBreakdown.processingFee) : formatCurrency(achBreakdown.processingFee)}</span>
                </div>
                <div className="mt-2 flex justify-between font-semibold text-slate-900">
                  <span>Total due now</span>
                  <span>{paymentMethod === 'card' ? formatCurrency(cardBreakdown.totalAmount) : formatCurrency(achBreakdown.totalAmount)}</span>
                </div>
              </div>
              <Button className="w-full" onClick={initializePayment} disabled={loading || !!minimumViolation}>
                {loading ? 'Preparing...' : `Continue to ${paymentMethod === 'card' ? 'Card Payment' : 'ACH Payment'}`}
              </Button>
            </div>
          ) : clientSecret && paymentIntentId ? (
            <Elements stripe={stripePromise} options={{ clientSecret }}>
              <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                <div className="flex justify-between">
                  <span>Order subtotal</span>
                  <span>{formatCurrency(totalAmount)}</span>
                </div>
                <div className="mt-1 flex justify-between">
                  <span>Delivery fee</span>
                  <span>{formatCurrency(timeSensitiveFee)}</span>
                </div>
                <div className="mt-1 flex justify-between">
                  <span>Stripe processing fee</span>
                  <span>{formatCurrency(processingFee)}</span>
                </div>
                <div className="mt-2 flex justify-between font-semibold text-slate-900">
                  <span>Total being charged</span>
                  <span>{formatCurrency(payableTotal)}</span>
                </div>
              </div>
              <PaymentForm
                customerId={customerId}
                orderType={orderType}
                items={items}
                total={payableTotal}
                notes={notes}
                deliveryTiming={deliveryTiming}
                preferredDeliveryDay={preferredDeliveryDay}
                preferredDeliveryTime={preferredDeliveryTime}
                deliveryRequirements={deliveryRequirements}
                paymentMethod={paymentMethod}
                processingFee={processingFee}
                paymentIntentId={paymentIntentId}
                onSuccess={(redirectTo) => { clearCart(); router.push(redirectTo ?? '/customer/orders') }}
              />
            </Elements>
          ) : (
            <p className="text-sm text-red-600">Stripe checkout could not be initialized. Please restart the payment step.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
