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

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? 'sk_test_missing_configuration', { apiVersion: '2026-02-25.clover' })

function isMissingStripeConnectColumn(error: unknown) {
  const dbError = error as { code?: string; message?: string; cause?: unknown } | null
  const code = dbError?.code ?? (dbError?.cause as { code?: string } | undefined)?.code
  const message = error instanceof Error ? error.message.toLowerCase() : ''

  return code === '42703' || message.includes('stripe_connect_account_id')
}

function getStripeErrorMessage(error: unknown) {
  if (error instanceof Stripe.errors.StripeError) {
    return error.message
  }

  return error instanceof Error ? error.message : 'Stripe payout failed.'
}

export async function payoutTasterInvoiceViaStripe(formData: FormData) {
  const session = await requireAdminOrStaff()
  const invoiceId = (formData.get('invoiceId') as string) || ''
  const mode = (formData.get('mode') as string) || 'admin'

  let invoice: {
    id: string
    totalAmount: string
    status: string
    payoutUserId: string
    payeeName: string
    tastingId: string
    eventName: string
    stripeConnectAccountId: string | null
  } | undefined

  try {
    ;[invoice] = await db
      .select({
        id: tasterInvoices.id,
        totalAmount: tasterInvoices.totalAmount,
        status: tasterInvoices.status,
        payoutUserId: tastings.assignedUserId,
        payeeName: tasterInvoices.payeeName,
        tastingId: tasterInvoices.tastingId,
        eventName: tastings.eventName,
        stripeConnectAccountId: users.stripeConnectAccountId,
      })
      .from(tasterInvoices)
      .innerJoin(tastings, eq(tasterInvoices.tastingId, tastings.id))
      .innerJoin(users, eq(tastings.assignedUserId, users.id))
      .where(eq(tasterInvoices.id, invoiceId))
      .limit(1)
  } catch (error) {
    if (isMissingStripeConnectColumn(error)) {
      redirect(`/${mode}/invoicing?error=${encodeURIComponent('Run db:migrate before using Stripe payouts.')}`)
    }

    throw error
  }

  if (!invoice) {
    redirect(`/${mode}/invoicing?error=${encodeURIComponent('Taster invoice not found.')}`)
  }

  if (invoice.status === 'paid') {
    redirect(`/${mode}/invoicing?success=${encodeURIComponent('That invoice is already marked paid.')}`)
  }

  if (!invoice.stripeConnectAccountId) {
    redirect(`/${mode}/invoicing?error=${encodeURIComponent(`${invoice.payeeName} has not connected Stripe payouts yet.`)}`)
  }

  let transfer: Stripe.Transfer

  try {
    const account = await stripe.accounts.retrieve(invoice.stripeConnectAccountId)
    if (!account.payouts_enabled) {
      redirect(`/${mode}/invoicing?error=${encodeURIComponent(`${invoice.payeeName}'s Stripe account is not ready for payouts yet.`)}`)
    }

    transfer = await stripe.transfers.create({
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
  } catch (error) {
    await logActivityEvent({
      entityType: 'tasting',
      entityId: invoice.tastingId,
      actorUserId: session.user.id,
      relatedUserId: invoice.payoutUserId,
      kind: 'taster_invoice_payout_failed',
      title: 'Taster payout failed',
      body: getStripeErrorMessage(error),
      metadata: {
        tasterInvoiceId: invoice.id,
        stripeDestinationAccountId: invoice.stripeConnectAccountId,
      },
    })
    redirect(`/${mode}/invoicing?error=${encodeURIComponent(getStripeErrorMessage(error))}`)
  }

  await db.update(tasterInvoices)
    .set({ status: 'paid' })
    .where(eq(tasterInvoices.id, invoice.id))

  await logActivityEvent({
    entityType: 'tasting',
    entityId: invoice.tastingId,
    actorUserId: session.user.id,
    relatedUserId: invoice.payoutUserId,
    kind: 'taster_invoice_paid',
    title: 'Taster invoice paid via Stripe',
    body: `${invoice.payeeName} was paid $${Number(invoice.totalAmount).toFixed(2)} via Stripe.`,
    metadata: {
      stripeTransferId: transfer.id,
      stripeDestinationAccountId: invoice.stripeConnectAccountId,
      amount: invoice.totalAmount,
      tasterInvoiceId: invoice.id,
    },
  })

  await createUserNotification({
    userId: invoice.payoutUserId,
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

export async function approveTasterInvoice(formData: FormData) {
  const session = await requireAdminOrStaff()
  const invoiceId = (formData.get('invoiceId') as string) || ''
  const mode = (formData.get('mode') as string) || 'admin'

  const [invoice] = await db
    .select({
      id: tasterInvoices.id,
      tastingId: tasterInvoices.tastingId,
      payeeName: tasterInvoices.payeeName,
      payoutUserId: tastings.assignedUserId,
      status: tasterInvoices.status,
    })
    .from(tasterInvoices)
    .innerJoin(tastings, eq(tasterInvoices.tastingId, tastings.id))
    .where(eq(tasterInvoices.id, invoiceId))
    .limit(1)

  if (!invoice) {
    redirect(`/${mode}/invoicing?error=${encodeURIComponent('Taster invoice not found.')}`)
  }

  if (invoice.status === 'paid') {
    redirect(`/${mode}/invoicing?success=${encodeURIComponent('That invoice has already been paid.')}`)
  }

  if (invoice.status !== 'approved') {
    await db
      .update(tasterInvoices)
      .set({ status: 'approved' })
      .where(eq(tasterInvoices.id, invoice.id))

    await logActivityEvent({
      entityType: 'tasting',
      entityId: invoice.tastingId,
      actorUserId: session.user.id,
      relatedUserId: invoice.payoutUserId,
      kind: 'taster_invoice_approved',
      title: 'Taster invoice approved',
      body: `${invoice.payeeName}'s invoice was approved for payout.`,
      metadata: { tasterInvoiceId: invoice.id, approvedByUserId: session.user.id },
    })
  }

  revalidatePath('/admin/invoicing')
  revalidatePath('/staff/invoicing')
  redirect(`/${mode}/invoicing?success=${encodeURIComponent(`Approved ${invoice.payeeName}'s invoice for payout.`)}`)
}
