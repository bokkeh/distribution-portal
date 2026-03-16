import { desc, eq, inArray, sql } from 'drizzle-orm'
import { db } from '@/db'
import { activityEvents, customerAccounts, invoices, tasterInvoices, tastings } from '@/db/schema'
import { requireFeature } from '@/lib/auth/session'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDate } from '@/lib/utils'

function getAgeBucket(dueDate: string | Date | null) {
  if (!dueDate) return 'Current'
  const due = new Date(dueDate)
  const diff = Math.floor((Date.now() - due.getTime()) / (1000 * 60 * 60 * 24))
  if (diff <= 0) return 'Current'
  if (diff <= 30) return '1-30'
  if (diff <= 60) return '31-60'
  if (diff <= 90) return '61-90'
  return '90+'
}

export default async function FinanceReconciliationPage() {
  await requireFeature('accounting', 'admin')

  const [openInvoices, payoutFailures, pendingTasterInvoices] = await Promise.all([
    db
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        total: invoices.total,
        dueDate: invoices.dueDate,
        status: invoices.status,
        companyName: customerAccounts.companyName,
      })
      .from(invoices)
      .leftJoin(customerAccounts, eq(invoices.customerId, customerAccounts.id))
      .where(inArray(invoices.status, ['draft', 'sent', 'overdue']))
      .orderBy(desc(invoices.createdAt)),
    db
      .select()
      .from(activityEvents)
      .where(eq(activityEvents.kind, 'taster_invoice_payout_failed'))
      .orderBy(desc(activityEvents.createdAt))
      .limit(50),
    db
      .select({
        id: tasterInvoices.id,
        totalAmount: tasterInvoices.totalAmount,
        status: tasterInvoices.status,
        submittedAt: tasterInvoices.submittedAt,
        eventName: tastings.eventName,
      })
      .from(tasterInvoices)
      .leftJoin(tastings, eq(tasterInvoices.tastingId, tastings.id))
      .where(inArray(tasterInvoices.status, ['submitted', 'approved']))
      .orderBy(desc(tasterInvoices.submittedAt)),
  ])

  const aging = openInvoices.reduce<Record<string, number>>((acc, invoice) => {
    const bucket = getAgeBucket(invoice.dueDate)
    acc[bucket] = (acc[bucket] ?? 0) + Number(invoice.total)
    return acc
  }, {})

  const unpaidTotal = openInvoices.reduce((sum, invoice) => sum + Number(invoice.total), 0)
  const payoutFailureCsv = `data:text/csv;charset=utf-8,${encodeURIComponent([
    ['Date', 'Title', 'Detail'],
    ...payoutFailures.map((event) => [event.createdAt.toISOString(), event.title, event.body ?? '']),
  ].map((row) => row.join(',')).join('\n'))}`

  return (
    <div className="space-y-6 p-4 sm:p-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reconciliation Workspace</h1>
          <p className="mt-1 text-muted-foreground">Open receivables, payout exceptions, and month-end close checkpoints in one place.</p>
        </div>
        <a href={payoutFailureCsv} download="payout-failures.csv">
          <Button variant="outline">Export Exceptions CSV</Button>
        </a>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardContent className="p-6"><p className="text-sm text-muted-foreground">Open Receivables</p><p className="mt-2 text-2xl font-bold">{formatCurrency(unpaidTotal)}</p></CardContent></Card>
        <Card><CardContent className="p-6"><p className="text-sm text-muted-foreground">Open Invoices</p><p className="mt-2 text-2xl font-bold">{openInvoices.length}</p></CardContent></Card>
        <Card><CardContent className="p-6"><p className="text-sm text-muted-foreground">Pending Taster Payouts</p><p className="mt-2 text-2xl font-bold">{pendingTasterInvoices.length}</p></CardContent></Card>
        <Card><CardContent className="p-6"><p className="text-sm text-muted-foreground">Failed Payouts</p><p className="mt-2 text-2xl font-bold">{payoutFailures.length}</p></CardContent></Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader><CardTitle>Aging Report</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {['Current', '1-30', '31-60', '61-90', '90+'].map((bucket) => (
              <div key={bucket} className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
                <span className="text-sm font-medium text-slate-700">{bucket}</span>
                <span className="text-sm font-semibold text-slate-900">{formatCurrency(aging[bucket] ?? 0)}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Month-End Close</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-700">
            <div className="rounded-xl border border-slate-200 px-4 py-3">Review {openInvoices.length} open invoices before close.</div>
            <div className="rounded-xl border border-slate-200 px-4 py-3">Resolve {pendingTasterInvoices.length} pending taster invoice approvals or payouts.</div>
            <div className="rounded-xl border border-slate-200 px-4 py-3">Follow up on {payoutFailures.length} Stripe payout failures.</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Open Receivables</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {openInvoices.slice(0, 12).map((invoice) => (
              <div key={invoice.id} className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">{invoice.invoiceNumber}</p>
                  <p className="text-xs text-muted-foreground">{invoice.companyName ?? 'Customer'} • Due {invoice.dueDate ? formatDate(invoice.dueDate) : '—'}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{formatCurrency(invoice.total)}</p>
                  <p className="text-xs text-muted-foreground">{getAgeBucket(invoice.dueDate)}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Payout Exceptions</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {payoutFailures.length === 0 ? (
              <p className="text-sm text-muted-foreground">No failed payouts right now.</p>
            ) : payoutFailures.slice(0, 12).map((event) => (
              <div key={event.id} className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                <p className="text-sm font-medium text-red-900">{event.title}</p>
                <p className="mt-1 text-xs text-red-700">{event.body ?? 'No detail recorded.'}</p>
                <p className="mt-2 text-[11px] text-red-600">{formatDate(event.createdAt)}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
