import type { Metadata } from 'next'
import { fieldContext } from '@/lib/field/access'
import { FieldTastingsOverview } from '@/components/field/FieldTastingsOverview'

export const metadata: Metadata = { title: 'Tastings · Field Notes', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

export default async function FieldTastingsPage() {
  await fieldContext()
  return <FieldTastingsOverview />
}
