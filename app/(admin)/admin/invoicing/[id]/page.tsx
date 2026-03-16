import { db } from '@/db'
import { invoices, customerAccounts, orders, orderItems, products } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDate } from '@/lib/utils'
import { sendInvoiceEmail, markInvoicePaid } from '@/actions/invoices'
import Link from 'next/link'
import { ArrowLeft, Send, Download } from 'lucide-react'

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [invoice] = await db
    .select({
      id: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      amount: invoices.amount,
      tax: invoices.tax,
      total: invoices.total,
      status: invoices.status,
      dueDate: invoices.dueDate,
      paidAt: invoices.paidAt,
      pdfUrl: invoices.pdfUrl,
      createdAt: invoices.createdAt,
      companyName: customerAccounts.companyName,
      customerEmail: customerAccounts.email,
      customerAddress: customerAccounts.address,
      customerCity: customerAccounts.city,
      customerState: customerAccounts.state,
    })
    .from(invoices)
    .leftJoin(customerAccounts, eq(invoices.customerId, customerAccounts.id))
    .where(eq(invoices.id, id))

  if (!invoice) notFound()

  const statusVariant: Record<string, 'default' | 'success' | 'warning' | 'destructive' | 'info'> = {
    draft: 'default', sent: 'info', paid: 'success', overdue: 'destructive',
  }

  return (
    <div className="p-8 space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <Link href="/admin/invoicing"><Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900">{invoice.invoiceNumber}</h1>
          <p className="text-muted-foreground mt-1">{invoice.companyName}</p>
        </div>
        <Badge variant={statusVariant[invoice.status]} className="text-sm px-3 py-1">{invoice.status.toUpperCase()}</Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Invoice Summary</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Invoice Number</p>
                <p className="font-medium">{invoice.invoiceNumber}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Issue Date</p>
                <p className="font-medium">{formatDate(invoice.createdAt)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Due Date</p>
                <p className="font-medium">{invoice.dueDate ? formatDate(invoice.dueDate) : '—'}</p>
              </div>
              {invoice.paidAt && (
                <div>
                  <p className="text-muted-foreground">Paid On</p>
                  <p className="font-medium text-green-600">{formatDate(invoice.paidAt)}</p>
                </div>
              )}
            </div>
            <div className="border-t pt-4 space-y-2">
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span>{formatCurrency(invoice.amount)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Tax</span><span>{formatCurrency(invoice.tax)}</span></div>
              <div className="flex justify-between font-bold text-lg border-t pt-2"><span>Total</span><span>{formatCurrency(invoice.total)}</span></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Actions</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {invoice.pdfUrl && (
              <a href={invoice.pdfUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" className="w-full"><Download className="w-4 h-4 mr-2" />Download PDF</Button>
              </a>
            )}
            {invoice.status === 'draft' && (
              <form action={sendInvoiceEmail.bind(null, invoice.id)}>
                <Button className="w-full" type="submit"><Send className="w-4 h-4 mr-2" />Send to Customer</Button>
              </form>
            )}
            {invoice.status !== 'paid' && (
              <form action={markInvoicePaid.bind(null, invoice.id)}>
                <Button variant="secondary" className="w-full" type="submit">Mark as Paid</Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
