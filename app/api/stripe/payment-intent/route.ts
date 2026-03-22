import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { auth } from '@/lib/auth/config'
import { getCustomerPaymentBreakdown, type CustomerPaymentMethod } from '@/lib/stripe/fees'

if (!process.env.STRIPE_SECRET_KEY) throw new Error('Missing STRIPE_SECRET_KEY')
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-02-25.clover' })

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { amount, customerId, invoiceId, paymentMethod } = await req.json()
  const method: CustomerPaymentMethod = paymentMethod === 'card' ? 'card' : 'us_bank_account'
  const baseAmountCents = Number(amount)

  if (!Number.isFinite(baseAmountCents) || baseAmountCents <= 0) {
    return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
  }

  const breakdown = getCustomerPaymentBreakdown(baseAmountCents, method)

  const paymentIntent = await stripe.paymentIntents.create({
    amount: breakdown.totalAmountCents,
    currency: 'usd',
    payment_method_types: [method],
    metadata: {
      customerId,
      paymentMethod: method,
      baseAmountCents: String(baseAmountCents),
      processingFeeCents: String(breakdown.processingFeeCents),
      ...(invoiceId ? { invoiceId } : {}),
    },
    ...(method === 'us_bank_account'
      ? {
          payment_method_options: {
            us_bank_account: {
              financial_connections: { permissions: ['payment_method'] },
            },
          },
        }
      : {}),
  })

  return NextResponse.json({
    clientSecret: paymentIntent.client_secret,
    amount: breakdown.totalAmount,
    processingFee: breakdown.processingFee,
  })
}
