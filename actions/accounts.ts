'use server'

import { db } from '@/db'
import { journalEntries, journalEntryLines, chartOfAccounts } from '@/db/schema'
import { requireAdmin } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function createJournalEntry(formData: FormData) {
  const session = await requireAdmin()

  const date = formData.get('date') as string
  const description = formData.get('description') as string
  const reference = formData.get('reference') as string | null
  const debitAccountId = formData.get('debitAccountId') as string
  const creditAccountId = formData.get('creditAccountId') as string
  const debitAmount = parseFloat(formData.get('debitAmount') as string)
  const creditAmount = parseFloat(formData.get('creditAmount') as string)

  const [entry] = await db.insert(journalEntries).values({
    date,
    description,
    reference: reference || null,
    createdBy: session.user.id,
  }).returning()

  await db.insert(journalEntryLines).values([
    { entryId: entry.id, accountId: debitAccountId, debit: debitAmount.toFixed(2), credit: '0' },
    { entryId: entry.id, accountId: creditAccountId, debit: '0', credit: creditAmount.toFixed(2) },
  ])

  revalidatePath('/admin/accounts/journal')
  redirect('/admin/accounts/journal')
}

export async function createAccount(formData: FormData) {
  await requireAdmin()

  await db.insert(chartOfAccounts).values({
    accountNumber: formData.get('accountNumber') as string,
    accountName: formData.get('accountName') as string,
    type: formData.get('type') as any,
    active: true,
  })

  revalidatePath('/admin/accounts')
  redirect('/admin/accounts')
}
