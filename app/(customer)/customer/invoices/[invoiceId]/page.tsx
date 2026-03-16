import { db } from '@/db'
import { invoices, customerAccounts } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { requireRole } from '@/lib/auth/session'
import { notFound } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDate } from '@/lib/utils'
import InvoicePaymentClient from '@/components/invoices/InvoicePaymentClient'
import { Download } from 'lucide-react'

export default async function CustomerInvoiceDetailPage({ params }: { params: Promise<{ invoiceId: string }> }) {
  const session = await requireRole('customer')
  const { invoiceId } = await params

  const [invoice] = await db
    .select({
      id: invoices.id, invoiceNumber: invoices.invoiceNumber, amount: invoices.amount, tax: invoices.tax,
      total: invoices.total, status: invoices.status, dueDate: invoices.dueDate, paidAt: invoices.paidAt,
      pdfUrl: invoices.pdfUrl, createdAt: invoices.createdAt,
      companyName: customerAccounts.companyName,
    })
    .from(invoices)
    .leftJoin(customerAccounts, eq(invoices.customerId, customerAccounts.id))
    .where(eq(invoices.id, invoiceId))

  if (!invoice) notFound()

  const statusVariant: Record<string, 'default' | 'success' | 'warning' | 'destructive' | 'info'> = {
    draft: 'default', sent: 'info', paid: 'success', overdue: 'destructive',
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{invoice.invoiceNumber}</h1>
          <p className="text-muted-foreground mt-1">{invoice.companyName}</p>
        </div>
        <Badge variant={statusVariant[invoice.status]} className="text-sm px-3 py-1">{invoice.status.toUpperCase()}</Badge>
      </div>

      <Card>
        <CardHeader><CardTitle>Invoice Details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><p className="text-muted-foreground">Invoice Number</p><p className="font-medium">{invoice.invoiceNumber}</p></div>
            <div><p className="text-muted-foreground">Issue Date</p><p className="font-medium">{formatDate(invoice.createdAt)}</p></div>
            <div><p className="text-muted-foreground">Due Date</p><p className="font-medium">{invoice.dueDate ? formatDate(invoice.dueDate) : '—'}</p></div>
            {invoice.paidAt && <div><p className="text-muted-foreground">Paid On</p><p className="font-medium text-green-600">{formatDate(invoice.paidAt)}</p></div>}
          </div>
          <div className="border-t pt-4 space-y-2">
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span>{formatCurrency(invoice.amount)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Tax</span><span>{formatCurrency(invoice.tax)}</span></div>
            <div className="flex justify-between font-bold text-xl border-t pt-2"><span>Total Due</span><span className="text-blue-600">{formatCurrency(invoice.total)}</span></div>
          </div>
          {invoice.pdfUrl && (
            <a href={invoice.pdfUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" className="w-full"><Download className="w-4 h-4 mr-2" />Download PDF</Button>
            </a>
          )}
        </CardContent>
      </Card>

      {invoice.status !== 'paid' && (
        <InvoicePaymentClient invoiceId={invoice.id} total={invoice.total} />
      )}
    </div>
  )
}
