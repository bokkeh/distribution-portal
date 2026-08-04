import { db } from '@/db'
import { activityEvents, invoices, customerAccounts } from '@/db/schema'
import { desc, eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Download, Send } from 'lucide-react'
import { CopyPaymentLinkButton } from '@/components/invoices/CopyPaymentLinkButton'
import { DeleteDraftInvoiceButton } from '@/components/invoices/DeleteDraftInvoiceButton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDate } from '@/lib/utils'
import { createInvoiceAdjustment, deleteDraftInvoice, markInvoicePaid, recordOfflineInvoicePayment, sendInvoiceEmail, setInvoiceAchFeeWaiver } from '@/actions/invoices'
import { getInvoiceDetailData } from '@/lib/invoices/read'
import { getInvoicePublicPaymentPath } from '@/lib/invoices/public-token'
import { InvoiceVisual } from '@/components/invoices/InvoiceVisual'

export default async function InvoiceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ success?: string; error?: string }>
}) {
  const { id } = await params
  const qs = await searchParams

  const [invoice] = await db
    .select({
      id: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      status: invoices.status,
      pdfUrl: invoices.pdfUrl,
      companyName: customerAccounts.companyName,
    })
    .from(invoices)
    .leftJoin(customerAccounts, eq(invoices.customerId, customerAccounts.id))
    .where(eq(invoices.id, id))

  if (!invoice) notFound()

  const invoiceVisual = await getInvoiceDetailData(invoice.id)
  if (!invoiceVisual) notFound()

  const financeEvents = await db
    .select()
    .from(activityEvents)
    .where(eq(activityEvents.entityId, invoice.id))
    .orderBy(desc(activityEvents.createdAt))
    .limit(12)

  const statusVariant: Record<string, 'default' | 'success' | 'warning' | 'destructive' | 'info'> = {
    draft: 'default',
    sent: 'info',
    paid: 'success',
    overdue: 'destructive',
  }

  return (
    <div className="max-w-6xl space-y-6 p-4 sm:p-8">
      {qs.success ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{qs.success}</div>
      ) : null}
      {qs.error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{qs.error}</div>
      ) : null}

      <div className="flex items-center gap-4">
        <Link href="/admin/invoicing"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900">{invoice.invoiceNumber}</h1>
          <p className="mt-1 text-muted-foreground">{invoice.companyName}</p>
          {invoiceVisual.orderId ? (
            <div className="mt-2">
              <Link href={`/admin/orders/${invoiceVisual.orderId}`}>
                <Button type="button" variant="outline" size="sm">View Linked Order #{invoiceVisual.orderId.slice(-8).toUpperCase()}</Button>
              </Link>
            </div>
          ) : null}
        </div>
        <Badge variant={statusVariant[invoice.status]} className="px-3 py-1 text-sm">{invoice.status.toUpperCase()}</Badge>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.45fr_0.8fr]">
        <InvoiceVisual invoice={invoiceVisual} />

        <div className="space-y-6">
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
              {invoice.status === 'draft' ? (
                <form action={sendInvoiceEmail.bind(null, invoice.id)}>
                  <Button className="w-full" type="submit"><Send className="mr-2 h-4 w-4" />Send to Customer</Button>
                </form>
              ) : null}
              {invoice.status !== 'paid' ? (
                <form action={markInvoicePaid.bind(null, invoice.id)}>
                  <Button variant="secondary" className="w-full" type="submit">Mark as Paid</Button>
                </form>
              ) : null}
              {invoice.status !== 'paid' ? (
                <CopyPaymentLinkButton paymentPath={getInvoicePublicPaymentPath(invoice.id)} />
              ) : null}
              {invoice.status !== 'paid' ? (
                <form action={setInvoiceAchFeeWaiver.bind(null, invoice.id, !invoiceVisual.waiveAchFee)}>
                  <Button variant="outline" className="w-full" type="submit">
                    {invoiceVisual.waiveAchFee ? 'Restore ACH Fee' : 'Waive ACH Fee'}
                  </Button>
                </form>
              ) : null}
              {invoice.status === 'draft' ? (
                <DeleteDraftInvoiceButton action={deleteDraftInvoice.bind(null, invoice.id)} />
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Manual Finance Actions</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <form action={recordOfflineInvoicePayment} className="space-y-3 rounded-2xl border border-slate-200 p-4">
                <input type="hidden" name="invoiceId" value={invoice.id} />
                <div>
                  <p className="text-sm font-medium text-slate-900">Record offline payment</p>
                  <p className="text-xs text-muted-foreground">Use for ACH, check, wire, or other off-portal payments.</p>
                </div>
                <input name="amount" type="number" min="0.01" step="0.01" defaultValue={invoiceVisual.total} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                <input name="note" placeholder="Reference or note" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                <Button type="submit" variant="outline" className="w-full">Record Offline Payment</Button>
              </form>

              <form action={createInvoiceAdjustment} className="space-y-3 rounded-2xl border border-slate-200 p-4">
                <input type="hidden" name="invoiceId" value={invoice.id} />
                <div>
                  <p className="text-sm font-medium text-slate-900">Credit memo / write-off / void</p>
                  <p className="text-xs text-muted-foreground">Post manual finance adjustments with audit history and journal support.</p>
                </div>
                <select name="adjustmentType" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
                  <option value="credit_memo">Credit memo</option>
                  <option value="write_off">Write off</option>
                  <option value="void">Void invoice</option>
                </select>
                <input name="amount" type="number" min="0.01" step="0.01" defaultValue={invoiceVisual.total} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                <input name="note" placeholder="Why is this adjustment needed?" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                <Button type="submit" variant="outline" className="w-full">Save Adjustment</Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Accounting History</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {financeEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No accounting activity recorded for this invoice yet.</p>
              ) : financeEvents.map((event) => (
                <div key={event.id} className="rounded-2xl border border-slate-200 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-slate-900">{event.title}</p>
                    <p className="text-[11px] text-muted-foreground">{formatDate(event.createdAt)}</p>
                  </div>
                  {event.body ? <p className="mt-1 text-sm text-slate-600">{event.body}</p> : null}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
