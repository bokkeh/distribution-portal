import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { db } from '@/db'
import { invoices, journalEntries, journalEntryLines, chartOfAccounts, users } from '@/db/schema'
import { eq } from 'drizzle-orm'

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
  } catch (err) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object as Stripe.PaymentIntent
    const invoiceId = paymentIntent.metadata?.invoiceId

    if (invoiceId) {
      const [invoice] = await db.select().from(invoices).where(eq(invoices.id, invoiceId))

      if (invoice && invoice.status !== 'paid') {
        await db.update(invoices)
          .set({ status: 'paid', paidAt: new Date(), stripePaymentIntentId: paymentIntent.id })
          .where(eq(invoices.id, invoiceId))

        // Auto-create journal entry
        const accounts = await db.select().from(chartOfAccounts)
        const cashAccount = accounts.find(a => a.accountNumber === '1000')
        const arAccount = accounts.find(a => a.accountNumber === '1100')

        const [adminUser] = await db.select().from(users).where(eq(users.role, 'admin')).limit(1)

        if (cashAccount && arAccount && adminUser) {
          const [entry] = await db.insert(journalEntries).values({
            date: new Date().toISOString().split('T')[0],
            description: `Stripe payment for ${invoice.invoiceNumber}`,
            reference: paymentIntent.id,
            createdBy: adminUser.id,
          }).returning()

          await db.insert(journalEntryLines).values([
            { entryId: entry.id, accountId: cashAccount.id, debit: invoice.total, credit: '0' },
            { entryId: entry.id, accountId: arAccount.id, debit: '0', credit: invoice.total },
          ])
        }
      }
    }
  }

  return NextResponse.json({ received: true })
}
