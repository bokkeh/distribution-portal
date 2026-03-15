'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import Stripe from 'stripe'
import { db } from '@/db'
import { tasterInvoices, tastings, users } from '@/db/schema'
import { requireAdminOrStaff } from '@/lib/auth/session'
import { logActivityEvent } from '@/lib/activity/log'
import { createUserNotification } from '@/lib/notifications/in-app'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? 'sk_test_placeholder', { apiVersion: '2026-02-25.clover' })

export async function payoutTasterInvoiceViaStripe(formData: FormData) {
  const session = await requireAdminOrStaff()
  const invoiceId = (formData.get('invoiceId') as string) || ''
  const mode = (formData.get('mode') as string) || 'admin'

  const [invoice] = await db
    .select({
      id: tasterInvoices.id,
      totalAmount: tasterInvoices.totalAmount,
      status: tasterInvoices.status,
      submittedByUserId: tasterInvoices.submittedByUserId,
      payeeName: tasterInvoices.payeeName,
      tastingId: tasterInvoices.tastingId,
      eventName: tastings.eventName,
      stripeConnectAccountId: users.stripeConnectAccountId,
    })
    .from(tasterInvoices)
    .innerJoin(tastings, eq(tasterInvoices.tastingId, tastings.id))
    .innerJoin(users, eq(tasterInvoices.submittedByUserId, users.id))
    .where(eq(tasterInvoices.id, invoiceId))
    .limit(1)

  if (!invoice) {
    redirect(`/${mode}/invoicing?error=${encodeURIComponent('Taster invoice not found.')}`)
  }

  if (invoice.status === 'paid') {
    redirect(`/${mode}/invoicing?success=${encodeURIComponent('That invoice is already marked paid.')}`)
  }

  if (!invoice.stripeConnectAccountId) {
    redirect(`/${mode}/invoicing?error=${encodeURIComponent(`${invoice.payeeName} has not connected Stripe payouts yet.`)}`)
  }

  const account = await stripe.accounts.retrieve(invoice.stripeConnectAccountId)
  if (!account.payouts_enabled) {
    redirect(`/${mode}/invoicing?error=${encodeURIComponent(`${invoice.payeeName}'s Stripe account is not ready for payouts yet.`)}`)
  }

  const transfer = await stripe.transfers.create({
    amount: Math.round(Number(invoice.totalAmount) * 100),
    currency: 'usd',
    destination: invoice.stripeConnectAccountId,
    metadata: {
      tasterInvoiceId: invoice.id,
      tastingId: invoice.tastingId,
      paidByUserId: session.user.id,
    },
    description: `AHAWC tasting payout for ${invoice.eventName}`,
  })

  await db.update(tasterInvoices)
    .set({ status: 'paid' })
    .where(eq(tasterInvoices.id, invoice.id))

  await logActivityEvent({
    entityType: 'tasting',
    entityId: invoice.tastingId,
    actorUserId: session.user.id,
    relatedUserId: invoice.submittedByUserId,
    kind: 'taster_invoice_paid',
    title: 'Taster invoice paid via Stripe',
    body: `${invoice.payeeName} was paid $${Number(invoice.totalAmount).toFixed(2)} via Stripe.`,
    metadata: {
      stripeTransferId: transfer.id,
      tasterInvoiceId: invoice.id,
    },
  })

  await createUserNotification({
    userId: invoice.submittedByUserId,
    kind: 'taster_invoice_paid',
    title: 'Stripe payout sent',
    body: `Your tasting invoice for ${invoice.eventName} has been paid out via Stripe.`,
    href: '/taster/payouts',
  })

  revalidatePath('/admin/invoicing')
  revalidatePath('/staff/invoicing')
  revalidatePath('/taster/payouts')
  revalidatePath(`/taster/tastings/${invoice.tastingId}`)
  redirect(`/${mode}/invoicing?success=${encodeURIComponent(`Stripe payout sent to ${invoice.payeeName}.`)}`)
}
