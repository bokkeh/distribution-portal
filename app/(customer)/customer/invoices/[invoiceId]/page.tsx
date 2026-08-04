import { db } from '@/db'
import { invoices, customerAccounts } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { requireRole } from '@/lib/auth/session'
import { notFound } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import InvoicePaymentClient from '@/components/invoices/InvoicePaymentClient'
import { Download } from 'lucide-react'
import { getInvoiceDetailData } from '@/lib/invoices/read'
import { InvoiceVisual } from '@/components/invoices/InvoiceVisual'

export default async function CustomerInvoiceDetailPage({ params }: { params: Promise<{ invoiceId: string }> }) {
  const session = await requireRole('customer')
  const { invoiceId } = await params

  const [invoice] = await db
    .select({
      id: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      total: invoices.total,
      status: invoices.status,
      pdfUrl: invoices.pdfUrl,
      companyName: customerAccounts.companyName,
      accountUserId: customerAccounts.userId,
    })
    .from(invoices)
    .leftJoin(customerAccounts, eq(invoices.customerId, customerAccounts.id))
    .where(eq(invoices.id, invoiceId))

  if (!invoice || invoice.accountUserId !== session.user.id) notFound()

  const invoiceVisual = await getInvoiceDetailData(invoice.id)
  if (!invoiceVisual) notFound()

  const statusVariant: Record<string, 'default' | 'success' | 'warning' | 'destructive' | 'info'> = {
    draft: 'default',
    sent: 'info',
    paid: 'success',
    overdue: 'destructive',
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{invoice.invoiceNumber}</h1>
          <p className="mt-1 text-muted-foreground">{invoice.companyName}</p>
        </div>
        <Badge variant={statusVariant[invoice.status]} className="px-3 py-1 text-sm">{invoice.status.toUpperCase()}</Badge>
      </div>

      <InvoiceVisual invoice={invoiceVisual} />

      <Card>
        <CardHeader><CardTitle>Invoice Actions</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <a href={`/api/invoices/${invoice.id}/pdf`}>
            <Button variant="outline" className="w-full"><Download className="mr-2 h-4 w-4" />Download Invoice PDF</Button>
          </a>
          {invoice.pdfUrl ? (
            <a href={invoice.pdfUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" className="w-full">Open legacy PDF</Button>
            </a>
          ) : null}
        </CardContent>
      </Card>

      {invoice.status !== 'paid' ? (
        <InvoicePaymentClient invoiceId={invoice.id} total={invoice.total} waiveAchFee={invoiceVisual.waiveAchFee} />
      ) : null}
    </div>
  )
}
