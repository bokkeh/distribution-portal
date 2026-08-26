import { db } from '@/db'
import { invoices, customerAccounts } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Download } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { markInvoicePaid } from '@/actions/invoices'
import { getInvoiceDetailData } from '@/lib/invoices/read'
import { InvoiceVisual } from '@/components/invoices/InvoiceVisual'
import { CustomerRecordLink } from '@/components/crm/CustomerRecordLink'

export default async function StaffInvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [invoice] = await db
    .select({
      id: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      status: invoices.status,
      pdfUrl: invoices.pdfUrl,
      customerId: invoices.customerId,
      companyName: customerAccounts.companyName,
    })
    .from(invoices)
    .leftJoin(customerAccounts, eq(invoices.customerId, customerAccounts.id))
    .where(eq(invoices.id, id))

  if (!invoice) notFound()

  const invoiceVisual = await getInvoiceDetailData(invoice.id)
  if (!invoiceVisual) notFound()

  const statusVariant: Record<string, 'default' | 'success' | 'warning' | 'destructive' | 'info'> = {
    draft: 'default',
    sent: 'info',
    paid: 'success',
    overdue: 'destructive',
  }

  return (
    <div className="max-w-6xl space-y-6 p-4 sm:p-8">
      <div className="flex items-center gap-4">
        <Link href="/staff/invoicing"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900">{invoice.invoiceNumber}</h1>
          <p className="mt-1 text-muted-foreground">
            <CustomerRecordLink accountId={invoice.customerId} name={invoice.companyName ?? 'Customer'} portal="staff" />
          </p>
        </div>
        <Badge variant={statusVariant[invoice.status]} className="px-3 py-1 text-sm">{invoice.status.toUpperCase()}</Badge>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.45fr_0.8fr]">
        <InvoiceVisual invoice={invoiceVisual} />

        <Card>
          <CardHeader><CardTitle>Actions</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <a href={`/api/invoices/${invoice.id}/pdf`}>
              <Button variant="outline" className="w-full"><Download className="mr-2 h-4 w-4" />Download Invoice PDF</Button>
            </a>
            {invoice.pdfUrl ? (
              <a href={invoice.pdfUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="ghost" className="w-full">Open legacy PDF</Button>
              </a>
            ) : null}
            {invoice.status !== 'paid' ? (
              <form action={markInvoicePaid.bind(null, invoice.id)}>
                <Button variant="secondary" className="w-full" type="submit">Mark as Paid</Button>
              </form>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
