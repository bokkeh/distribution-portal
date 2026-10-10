import type { Metadata } from 'next'
import { getEffectiveSession } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import { getFieldAccount, getFieldAvailability, getFieldBootstrap } from '@/actions/field-data'
import { getFieldDocument } from '@/actions/field-documents'
import { FieldHub } from '@/components/field/FieldHub'

export const metadata: Metadata = { title: 'Field Notes · AHAWC / Wisher', robots: { index: false, follow: false } }

export default async function FieldPage({ searchParams }: { searchParams: Promise<{ invoice?: string }> }) {
  const params = await searchParams
  const invoice = params.invoice && /^[0-9a-f-]{36}$/i.test(params.invoice) ? params.invoice : undefined
  if (!(await getEffectiveSession())) redirect(`/login?next=${encodeURIComponent(`/field${invoice ? `?invoice=${invoice}` : ''}`)}`)
  const [bootstrap, availability] = await Promise.all([getFieldBootstrap(), getFieldAvailability()])
  const document = invoice ? await getFieldDocument(invoice) : null
  const account = document ? await getFieldAccount(document.accountId) : null
  return <FieldHub bootstrap={bootstrap} availability={availability} initialDocument={document} initialAccount={account} />
}
