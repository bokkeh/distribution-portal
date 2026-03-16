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

async function getFinanceAccounts() {
  const accounts = await db.select().from(chartOfAccounts)
  return {
    accounts,
    cashAccount: accounts.find(a => a.accountNumber === '1000') ?? accounts.find(a => a.type === 'asset'),
    arAccount: accounts.find(a => a.accountNumber === '1100') ?? accounts.find(a => a.type === 'asset'),
    revenueAccount: accounts.find(a => a.type === 'revenue'),
    expenseAccount: accounts.find(a => a.type === 'expense'),
  }
}

async function createJournalEntryForLines(input: {
  date?: string
  description: string
  reference?: string | null
  createdBy: string
  lines: Array<{
    accountId: string
    debit: string
    credit: string
    description: string
  }>
}) {
  const [entry] = await db.insert(journalEntries).values({
    date: input.date ?? new Date().toISOString().split('T')[0],
    description: input.description,
    reference: input.reference ?? null,
    createdBy: input.createdBy,
  }).returning()

  await db.insert(journalEntryLines).values(
    input.lines.map(line => ({
      entryId: entry.id,
      accountId: line.accountId,
      debit: line.debit,
      credit: line.credit,
      description: line.description,
    })),
  )

  return entry
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
  const { cashAccount, arAccount } = await getFinanceAccounts()

  if (cashAccount && arAccount) {
    await createJournalEntryForLines({
      description: `Payment received for ${invoice.invoiceNumber}`,
      reference: invoice.invoiceNumber,
      createdBy: session.user.id,
      lines: [
        { accountId: cashAccount.id, debit: invoice.total, credit: '0', description: 'Cash received' },
        { accountId: arAccount.id, debit: '0', credit: invoice.total, description: 'AR cleared' },
      ],
    })
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

export async function recordOfflineInvoicePayment(formData: FormData) {
  const session = await requireAdminOrStaff()
  const invoiceId = formData.get('invoiceId') as string
  const amount = Number(formData.get('amount') as string)
  const note = (formData.get('note') as string) || 'Offline payment recorded.'

  if (!invoiceId || !Number.isFinite(amount) || amount <= 0) {
    redirect('/admin/invoicing?error=' + encodeURIComponent('Enter a valid offline payment amount.'))
  }

  const [invoice] = await db
    .select({
      id: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      total: invoices.total,
      status: invoices.status,
      customerId: invoices.customerId,
      orderId: invoices.orderId,
    })
    .from(invoices)
    .where(eq(invoices.id, invoiceId))
    .limit(1)

  if (!invoice) {
    redirect('/admin/invoicing?error=' + encodeURIComponent('Invoice not found.'))
  }

  const { cashAccount, arAccount } = await getFinanceAccounts()
  if (cashAccount && arAccount) {
    await createJournalEntryForLines({
      description: `Offline payment recorded for ${invoice.invoiceNumber}`,
      reference: invoice.invoiceNumber,
      createdBy: session.user.id,
      lines: [
        { accountId: cashAccount.id, debit: amount.toFixed(2), credit: '0', description: 'Offline payment received' },
        { accountId: arAccount.id, debit: '0', credit: amount.toFixed(2), description: 'AR reduction' },
      ],
    })
  }

  await logActivityEvent({
    entityType: 'invoice',
    entityId: invoice.id,
    actorUserId: session.user.id,
    kind: 'invoice_offline_payment_recorded',
    title: 'Offline payment recorded',
    body: `$${amount.toFixed(2)} recorded against ${invoice.invoiceNumber}. ${note}`.trim(),
    metadata: { amount, note },
  })

  if (amount >= Number(invoice.total) && invoice.status !== 'paid') {
    await db.update(invoices).set({ status: 'paid', paidAt: new Date() }).where(eq(invoices.id, invoice.id))
  }

  revalidatePath(`/admin/invoicing/${invoice.id}`)
  revalidatePath('/admin/invoicing')
  revalidatePath('/admin/accounts/journal')
  redirect(`/admin/invoicing/${invoice.id}?success=${encodeURIComponent('Offline payment recorded.')}`)
}

export async function createInvoiceAdjustment(formData: FormData) {
  const session = await requireAdminOrStaff()
  const invoiceId = formData.get('invoiceId') as string
  const adjustmentType = (formData.get('adjustmentType') as string) || 'credit_memo'
  const note = (formData.get('note') as string) || null
  const amountRaw = formData.get('amount') as string
  const amount = Number(amountRaw)

  const [invoice] = await db
    .select({
      id: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      total: invoices.total,
      status: invoices.status,
    })
    .from(invoices)
    .where(eq(invoices.id, invoiceId))
    .limit(1)

  if (!invoice) {
    redirect('/admin/invoicing?error=' + encodeURIComponent('Invoice not found.'))
  }

  const effectiveAmount = adjustmentType === 'void' ? Number(invoice.total) : amount
  if (!Number.isFinite(effectiveAmount) || effectiveAmount <= 0) {
    redirect(`/admin/invoicing/${invoice.id}?error=${encodeURIComponent('Enter a valid adjustment amount.')}`)
  }

  const { arAccount, revenueAccount, expenseAccount } = await getFinanceAccounts()

  if (arAccount && (revenueAccount || expenseAccount)) {
    const contraAccountId = adjustmentType === 'write_off'
      ? (expenseAccount?.id ?? revenueAccount?.id)
      : (revenueAccount?.id ?? expenseAccount?.id)

    if (contraAccountId) {
      const lines = adjustmentType === 'write_off'
        ? [
            { accountId: contraAccountId, debit: effectiveAmount.toFixed(2), credit: '0', description: 'Write-off expense' },
            { accountId: arAccount.id, debit: '0', credit: effectiveAmount.toFixed(2), description: 'AR reduction' },
          ]
        : [
            { accountId: contraAccountId, debit: effectiveAmount.toFixed(2), credit: '0', description: adjustmentType === 'credit_memo' ? 'Credit memo' : 'Invoice void' },
            { accountId: arAccount.id, debit: '0', credit: effectiveAmount.toFixed(2), description: 'AR reduction' },
          ]

      await createJournalEntryForLines({
        description: `${adjustmentType.replaceAll('_', ' ')} for ${invoice.invoiceNumber}`,
        reference: invoice.invoiceNumber,
        createdBy: session.user.id,
        lines,
      })
    }
  }

  await logActivityEvent({
    entityType: 'invoice',
    entityId: invoice.id,
    actorUserId: session.user.id,
    kind: `invoice_${adjustmentType}`,
    title: adjustmentType === 'credit_memo' ? 'Credit memo created' : adjustmentType === 'write_off' ? 'Invoice written off' : 'Invoice voided',
    body: `${invoice.invoiceNumber} ${adjustmentType.replaceAll('_', ' ')} for $${effectiveAmount.toFixed(2)}.${note ? ` ${note}` : ''}`,
    metadata: { adjustmentType, amount: effectiveAmount, note },
  })

  revalidatePath(`/admin/invoicing/${invoice.id}`)
  revalidatePath('/admin/accounts/journal')
  redirect(`/admin/invoicing/${invoice.id}?success=${encodeURIComponent('Invoice adjustment recorded.')}`)
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
