'use server'

import { db } from '@/db'
import { invoices, customerAccounts, journalEntries, journalEntryLines, chartOfAccounts } from '@/db/schema'
import { requireAdminOrStaff, requireAdmin, requireAuth } from '@/lib/auth/session'
import { eq, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import Stripe from 'stripe'
import { logActivityEvent } from '@/lib/activity/log'
import { sendInvoicePaidConfirmationEmail } from '@/lib/resend/client'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? 'sk_test_placeholder', { apiVersion: '2026-02-25.clover' })

function generateInvoiceNumber(seq: number) {
  return `INV-${new Date().getFullYear()}-${String(seq).padStart(5, '0')}`
}

export async function createInvoice(formData: FormData) {
  const session = await requireAdminOrStaff()

  const customerId = formData.get('customerId') as string
  const orderId = formData.get('orderId') as string | null
  const amount = parseFloat(formData.get('amount') as string)
  const tax = parseFloat((formData.get('tax') as string) || '0')
  const total = amount + tax
  const dueDate = formData.get('dueDate') as string | null

  // Generate sequential invoice number
  const [{ count }] = await db.select({ count: sql<number>`COUNT(*)` }).from(invoices)
  const invoiceNumber = generateInvoiceNumber(Number(count) + 1)

  const [invoice] = await db.insert(invoices).values({
    customerId,
    orderId: orderId || null,
    invoiceNumber,
    amount: amount.toFixed(2),
    tax: tax.toFixed(2),
    total: total.toFixed(2),
    status: 'draft',
    dueDate: dueDate || null,
  }).returning()

  revalidatePath('/admin/invoicing')
  redirect(`/admin/invoicing/${invoice.id}`)
}

export async function sendInvoiceEmail(invoiceId: string) {
  await requireAdminOrStaff()

  const [invoice] = await db
    .select({
      id: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      total: invoices.total,
      customerEmail: customerAccounts.email,
      companyName: customerAccounts.companyName,
    })
    .from(invoices)
    .leftJoin(customerAccounts, eq(invoices.customerId, customerAccounts.id))
    .where(eq(invoices.id, invoiceId))

  if (!invoice) return

  // Send email via Resend
  const { sendInvoiceEmailNotification } = await import('@/lib/resend/client')
  await sendInvoiceEmailNotification({
    to: invoice.customerEmail ?? '',
    invoiceNumber: invoice.invoiceNumber,
    companyName: invoice.companyName ?? '',
    total: invoice.total,
    invoiceUrl: `${process.env.NEXTAUTH_URL}/customer/invoices/${invoiceId}`,
  })

  await db.update(invoices).set({ status: 'sent' }).where(eq(invoices.id, invoiceId))
  revalidatePath(`/admin/invoicing/${invoiceId}`)
}

export async function markInvoicePaid(invoiceId: string) {
  const session = await requireAdminOrStaff()

  const [invoice] = await db
    .select({
      id: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      orderId: invoices.orderId,
      total: invoices.total,
      customerId: invoices.customerId,
      companyName: customerAccounts.companyName,
      email: customerAccounts.email,
      businessEmail: customerAccounts.businessEmail,
      pocEmail: customerAccounts.pocEmail,
    })
    .from(invoices)
    .leftJoin(customerAccounts, eq(invoices.customerId, customerAccounts.id))
    .where(eq(invoices.id, invoiceId))
  if (!invoice) return

  await db.update(invoices).set({ status: 'paid', paidAt: new Date() }).where(eq(invoices.id, invoiceId))

  if (invoice.orderId) {
    await logActivityEvent({
      entityType: 'order',
      entityId: invoice.orderId,
      actorUserId: session.user.id,
      kind: 'invoice_paid',
      title: 'Invoice marked paid',
      body: `${invoice.invoiceNumber} was marked paid for $${Number(invoice.total).toFixed(2)}.`,
    })
  }

  // Auto-create journal entry: DR Cash / CR Accounts Receivable
  const accounts = await db.select().from(chartOfAccounts)
  const cashAccount = accounts.find(a => a.accountNumber === '1000')
  const arAccount = accounts.find(a => a.accountNumber === '1100')

  if (cashAccount && arAccount) {
    const [entry] = await db.insert(journalEntries).values({
      date: new Date().toISOString().split('T')[0],
      description: `Payment received for ${invoice.invoiceNumber}`,
      reference: invoice.invoiceNumber,
      createdBy: session.user.id,
    }).returning()

    await db.insert(journalEntryLines).values([
      { entryId: entry.id, accountId: cashAccount.id, debit: invoice.total, credit: '0', description: 'Cash received' },
      { entryId: entry.id, accountId: arAccount.id, debit: '0', credit: invoice.total, description: 'AR cleared' },
    ])
  }

  const invoiceEmails = Array.from(new Set(
    [invoice.pocEmail, invoice.businessEmail, invoice.email]
      .map((value) => value?.trim())
      .filter(Boolean) as string[],
  ))

  if (invoice.companyName && invoiceEmails.length) {
    await sendInvoicePaidConfirmationEmail({
      to: invoiceEmails,
      companyName: invoice.companyName,
      invoiceNumber: invoice.invoiceNumber,
      total: invoice.total,
    })
  }

  revalidatePath(`/admin/invoicing/${invoiceId}`)
  revalidatePath('/admin/accounts/journal')
}

export async function createPaymentIntent(invoiceId: string) {
  await requireAuth()

  const [invoice] = await db.select().from(invoices).where(eq(invoices.id, invoiceId))
  if (!invoice) throw new Error('Invoice not found')

  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(parseFloat(invoice.total) * 100),
    currency: 'usd',
    metadata: { invoiceId },
    payment_method_types: ['card', 'us_bank_account'],
    payment_method_options: {
      us_bank_account: {
        financial_connections: { permissions: ['payment_method'] },
      },
    },
  })

  await db.update(invoices).set({ stripePaymentIntentId: paymentIntent.id }).where(eq(invoices.id, invoiceId))

  return { clientSecret: paymentIntent.client_secret }
}
