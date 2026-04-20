import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { customerAccounts } from '@/db/schema'
import { getCustomerPaymentBreakdown, type CustomerPaymentMethod } from '@/lib/stripe/fees'
import { isPaymentIntentRateLimited, rateLimitResponse } from '@/lib/auth/rate-limit'
import { getEffectiveSession } from '@/lib/auth/session'
import { buildPricedLineItems, computeDeliveryFee, type CheckoutOrderType } from '@/lib/orders/checkout'

if (!process.env.STRIPE_SECRET_KEY) throw new Error('Missing STRIPE_SECRET_KEY')
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-02-25.clover' })

export async function POST(req: NextRequest) {
  try {
    const session = await getEffectiveSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    if (await isPaymentIntentRateLimited(session.user.id)) return rateLimitResponse()

    const {
      customerId,
      items,
      orderType,
      deliveryTiming,
      preferredDeliveryDay,
      paymentMethod,
    } = await req.json()
    const method: CustomerPaymentMethod = paymentMethod === 'card' ? 'card' : 'us_bank_account'
    const normalizedOrderType: CheckoutOrderType = orderType === 'sample' ? 'sample' : 'paid'
    const normalizedItems = Array.isArray(items)
      ? items
          .map((item) => ({
            productId: typeof item?.productId === 'string' ? item.productId : '',
            quantity: Number(item?.quantity),
          }))
          .filter((item) => item.productId && Number.isFinite(item.quantity) && item.quantity > 0)
      : []

    if (!customerId || !normalizedItems.length) {
      return NextResponse.json({ error: 'Your checkout items are invalid. Please refresh and try again.' }, { status: 400 })
    }

    const roles = session.user.roles ?? [session.user.role as string]
    let customerBusinessType: string | null = null

    if (roles.includes('customer')) {
      const [account] = await db
        .select({
          id: customerAccounts.id,
          businessType: customerAccounts.businessType,
        })
        .from(customerAccounts)
        .where(eq(customerAccounts.userId, session.user.id))
        .limit(1)

      if (!account || account.id !== customerId) {
        return NextResponse.json({ error: 'Unauthorized customer checkout.' }, { status: 403 })
      }

      customerBusinessType = account.businessType
    } else if (roles.some((role) => ['admin', 'staff'].includes(role))) {
      const [account] = await db
        .select({
          businessType: customerAccounts.businessType,
        })
        .from(customerAccounts)
        .where(eq(customerAccounts.id, customerId))
        .limit(1)

      customerBusinessType = account?.businessType ?? null
    } else {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { subtotal } = await buildPricedLineItems({
      customerId,
      purchaseUnit: 'case',
      orderDate: new Date(),
      orderType: normalizedOrderType,
      items: normalizedItems,
      customerBusinessType,
    })
    const deliveryFee = computeDeliveryFee(deliveryTiming, preferredDeliveryDay)
    const baseAmountCents = Math.round((subtotal + deliveryFee) * 100)
    const breakdown = getCustomerPaymentBreakdown(baseAmountCents, method)

    const paymentIntent = await stripe.paymentIntents.create({
      amount: breakdown.totalAmountCents,
      currency: 'usd',
      payment_method_types: [method],
      metadata: {
        checkoutScope: 'customer_order',
        customerId,
        orderType: normalizedOrderType,
        paymentMethod: method,
        baseAmountCents: String(baseAmountCents),
        processingFeeCents: String(breakdown.processingFeeCents),
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
      paymentIntentId: paymentIntent.id,
      amount: breakdown.totalAmount,
      processingFee: breakdown.processingFee,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to initialize Stripe payment' },
      { status: 400 },
    )
  }
}
