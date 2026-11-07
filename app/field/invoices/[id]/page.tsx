import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdminOrStaff } from '@/lib/auth/session'
import { getInvoiceDetailData } from '@/lib/invoices/read'
import { getInvoicePublicPaymentPath } from '@/lib/invoices/public-token'
import { InvoiceVisual } from '@/components/invoices/InvoiceVisual'
import { InvoiceSendForm } from '@/components/invoices/InvoiceSendForm'
import { CopyPaymentLinkButton } from '@/components/invoices/CopyPaymentLinkButton'
import { Button } from '@/components/ui/button'

export default async function FieldInvoicePage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; success?: string }>
}) {
  const session = await requireAdminOrStaff()
  const portal = session.user.roles.includes('admin') ? 'admin' : 'staff'
  const { id } = await params
  const qs = await searchParams
  const invoice = await getInvoiceDetailData(id)
  if (!invoice) notFound()
  return <main className="mx-auto max-w-4xl space-y-5 p-4">
    <Link className="inline-flex min-h-12 items-center underline" href="/field">Back to Field Notes</Link>
    <h1 className="text-2xl font-semibold">{invoice.invoiceNumber}</h1>
    <p>{invoice.companyName} · {invoice.status}</p>
    {qs.error ? <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">{qs.error}</p> : null}
    {qs.success ? <p role="status" className="rounded-xl bg-green-50 p-4 text-green-800">{qs.success}</p> : null}
    <InvoiceVisual invoice={invoice} />
    <a className="inline-flex min-h-12 items-center rounded-lg border px-4" href={`/api/invoices/${invoice.id}/pdf`}>Download invoice PDF</a>
    <InvoiceSendForm invoiceId={invoice.id} status={invoice.status} portal="field" defaultEmail={invoice.customerEmail ?? ''} />
    <CopyPaymentLinkButton paymentPath={getInvoicePublicPaymentPath(invoice.id)} />
    <Link href={`/${portal}/invoicing/${invoice.id}`}><Button variant="outline" className="min-h-12">Record check / payment</Button></Link>
  </main>
}
