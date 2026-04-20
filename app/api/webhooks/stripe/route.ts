import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { users } from '@/db/schema'
import { applyWebhookInvoicePaid } from '@/actions/invoices'
import { applyWebhookOrderPaymentUpdate } from '@/actions/orders'

if (!process.env.STRIPE_SECRET_KEY) throw new Error('Missing STRIPE_SECRET_KEY')
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-02-25.clover' })

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  if (
    event.type === 'payment_intent.succeeded' ||
    event.type === 'payment_intent.processing' ||
    event.type === 'payment_intent.payment_failed' ||
    event.type === 'payment_intent.canceled'
  ) {
    const paymentIntent = event.data.object as Stripe.PaymentIntent
    const invoiceId = paymentIntent.metadata?.invoiceId

    const [adminUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.role, 'admin'))
      .limit(1)

    if (adminUser) {
      if (invoiceId && event.type === 'payment_intent.succeeded') {
        await applyWebhookInvoicePaid(invoiceId, paymentIntent.id, adminUser.id)
      }

      await applyWebhookOrderPaymentUpdate(paymentIntent.id, paymentIntent.status, adminUser.id)
    }
  }

  return NextResponse.json({ received: true })
}
