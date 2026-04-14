import { db } from '@/db'
import { activityEvents, customerAccounts, invoices, orders, tasterInvoices, tastings, users } from '@/db/schema'
import { desc, eq, inArray } from 'drizzle-orm'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency, formatDate } from '@/lib/utils'
import Link from 'next/link'
import { Plus, Receipt } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { markInvoicePaid } from '@/actions/invoices'
import { approveTasterInvoice, payoutTasterInvoiceViaStripe } from '@/actions/taster-payouts'

function isMissingTasterInvoiceTable(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()
  return message.includes('taster_invoices') && message.includes('does not exist')
}

function isMissingTasterInvoiceReceiptColumn(error: unknown) {
  const code = (error as { code?: string; cause?: { code?: string } } | null)?.code
    ?? (error as { cause?: { code?: string } } | null)?.cause?.code
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()
  return code === '42703' || message.includes('receipt_urls')
}

export default async function InvoicingPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>
}) {
  const query = await searchParams
  let tasterInvoiceSubmissions: Array<{
    id: string
    tastingId: string
    totalAmount: string
    status: string
    submittedAt: Date
    payeeName: string
    payeeEmail: string
    receiptUrls: string[] | null
    eventName: string
    scheduledAt: Date
  }> = []

  let payoutEvents: Array<{
    kind: string
    body: string | null
    metadata: unknown
    createdAt: Date
  }> = []

  const recentOrders = await db
    .select({
      id: orders.id,
      total: orders.total,
      status: orders.status,
      createdAt: orders.createdAt,
      companyName: customerAccounts.companyName,
      invoiceId: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      invoiceStatus: invoices.status,
    })
    .from(orders)
    .leftJoin(customerAccounts, eq(orders.customerId, customerAccounts.id))
    .leftJoin(invoices, eq(invoices.orderId, orders.id))
    .orderBy(desc(orders.createdAt))
    .limit(25)

  const allInvoices = await db
    .select({
      id: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      orderId: invoices.orderId,
      total: invoices.total,
      status: invoices.status,
      dueDate: invoices.dueDate,
      createdAt: invoices.createdAt,
      companyName: customerAccounts.companyName,
    })
    .from(invoices)
    .leftJoin(customerAccounts, eq(invoices.customerId, customerAccounts.id))
    .orderBy(desc(invoices.createdAt))

  try {
    tasterInvoiceSubmissions = await db
      .select({
        id: tasterInvoices.id,
        tastingId: tasterInvoices.tastingId,
        totalAmount: tasterInvoices.totalAmount,
        status: tasterInvoices.status,
        submittedAt: tasterInvoices.submittedAt,
        payeeName: tasterInvoices.payeeName,
        payeeEmail: tasterInvoices.payeeEmail,
        receiptUrls: tasterInvoices.receiptUrls,
        eventName: tastings.eventName,
        scheduledAt: tastings.scheduledAt,
      })
      .from(tasterInvoices)
      .innerJoin(tastings, eq(tasterInvoices.tastingId, tastings.id))
      .innerJoin(users, eq(tasterInvoices.submittedByUserId, users.id))
      .orderBy(desc(tasterInvoices.submittedAt))

    payoutEvents = await db
      .select({
        kind: activityEvents.kind,
        body: activityEvents.body,
        metadata: activityEvents.metadata,
        createdAt: activityEvents.createdAt,
      })
      .from(activityEvents)
      .where(inArray(activityEvents.kind, ['taster_invoice_paid', 'taster_invoice_payout_failed', 'taster_invoice_approved']))
      .orderBy(desc(activityEvents.createdAt))
  } catch (error) {
    if (isMissingTasterInvoiceReceiptColumn(error)) {
      tasterInvoiceSubmissions = await db
        .select({
          id: tasterInvoices.id,
          tastingId: tasterInvoices.tastingId,
          totalAmount: tasterInvoices.totalAmount,
          status: tasterInvoices.status,
          submittedAt: tasterInvoices.submittedAt,
          payeeName: tasterInvoices.payeeName,
          payeeEmail: tasterInvoices.payeeEmail,
          eventName: tastings.eventName,
          scheduledAt: tastings.scheduledAt,
        })
        .from(tasterInvoices)
        .innerJoin(tastings, eq(tasterInvoices.tastingId, tastings.id))
        .innerJoin(users, eq(tasterInvoices.submittedByUserId, users.id))
        .orderBy(desc(tasterInvoices.submittedAt))
        .then((rows) => rows.map((row) => ({ ...row, receiptUrls: null })))

      payoutEvents = await db
        .select({
          kind: activityEvents.kind,
          body: activityEvents.body,
          metadata: activityEvents.metadata,
          createdAt: activityEvents.createdAt,
        })
        .from(activityEvents)
        .where(inArray(activityEvents.kind, ['taster_invoice_paid', 'taster_invoice_payout_failed', 'taster_invoice_approved']))
        .orderBy(desc(activityEvents.createdAt))
    } else if (!isMissingTasterInvoiceTable(error)) {
      throw error
    }

    const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()
    if (!message.includes('taster_invoices') && !message.includes('does not exist') && !message.includes('receipt_urls')) {
      throw error
    }
  }

  const payoutEventMap = new Map<string, typeof payoutEvents>()
  for (const event of payoutEvents) {
    const metadata = event.metadata && typeof event.metadata === 'object' ? event.metadata as Record<string, unknown> : {}
    const invoiceId = typeof metadata.tasterInvoiceId === 'string' ? metadata.tasterInvoiceId : null
    if (!invoiceId) continue
    const group = payoutEventMap.get(invoiceId) ?? []
    group.push({ ...event, metadata })
    payoutEventMap.set(invoiceId, group)
  }

  const csvRows = [
    ['payee_name', 'payee_email', 'event_name', 'amount', 'status', 'submitted_at'],
    ...tasterInvoiceSubmissions.map((invoice) => [
      invoice.payeeName,
      invoice.payeeEmail,
      invoice.eventName,
      String(invoice.totalAmount),
      invoice.status,
      invoice.submittedAt.toISOString(),
    ]),
  ]
  const csvHref = `data:text/csv;charset=utf-8,${encodeURIComponent(csvRows.map((row) => row.join(',')).join('\n'))}`

  const statusVariant: Record<string, 'default' | 'success' | 'warning' | 'destructive' | 'info'> = {
    draft: 'default',
    sent: 'info',
    paid: 'success',
    overdue: 'destructive',
  }

  const tasterStatusVariant: Record<string, 'default' | 'success' | 'warning' | 'destructive' | 'info'> = {
    submitted: 'warning',
    approved: 'info',
    paid: 'success',
  }

  return (
    <div className="p-4 sm:p-8 space-y-6">
      {query.success ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{query.success}</div>
      ) : null}
      {query.error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{query.error}</div>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Invoicing</h1>
          <p className="text-muted-foreground mt-1">Manage and track all invoices</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={csvHref} download="taster-invoices.csv">
            <Button variant="outline">Export Taster Invoices</Button>
          </a>
          <Link href="/admin/invoicing/new">
            <Button><Plus className="mr-2 h-4 w-4" />New Invoice</Button>
          </Link>
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b bg-slate-50 sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Invoice #</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Customer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Order</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Due Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Created</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {allInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={8}>
                      <EmptyState icon={Receipt} title="No invoices yet" description="Create your first invoice to get started." action={<Link href="/admin/invoicing/new"><Button size="sm">New Invoice</Button></Link>} />
                    </td>
                  </tr>
                ) : allInvoices.map((inv) => (
                  <tr key={inv.id} className="transition-colors hover:bg-slate-50">
                    <td className="px-6 py-4 text-sm font-medium">{inv.invoiceNumber}</td>
                    <td className="px-6 py-4 text-sm">{inv.companyName ?? 'N/A'}</td>
                    <td className="px-6 py-4 text-sm">
                      {inv.orderId ? (
                        <Link href={`/admin/orders/${inv.orderId}`} className="font-medium text-blue-600 underline">
                          #{inv.orderId.slice(-8).toUpperCase()}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">Direct invoice</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold">{formatCurrency(inv.total)}</td>
                    <td className="px-6 py-4"><Badge variant={statusVariant[inv.status]}>{inv.status}</Badge></td>
                    <td className="px-6 py-4 text-sm">{inv.dueDate ? formatDate(inv.dueDate) : '—'}</td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">{formatDate(inv.createdAt)}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-2">
                        <Link href={`/admin/invoicing/${inv.id}`}>
                          <Button variant="ghost" size="sm">View</Button>
                        </Link>
                        <a href={`/api/invoices/${inv.id}/pdf`}>
                          <Button variant="outline" size="sm">Download PDF</Button>
                        </a>
                        {inv.status !== 'paid' ? (
                          <form action={markInvoicePaid.bind(null, inv.id)}>
                            <Button variant="secondary" size="sm" type="submit">Mark Paid</Button>
                          </form>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Recent Orders & Invoice Status</CardTitle>
          <p className="text-sm text-muted-foreground">Recent orders are shown here with their linked invoice status so accounting can see what still needs to be invoiced.</p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Order</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Customer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Order Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Total</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Invoice</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Placed</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {recentOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-10 text-center text-muted-foreground">No recent orders found.</td>
                  </tr>
                ) : recentOrders.map((order) => (
                  <tr key={order.id} className="transition-colors hover:bg-slate-50">
                    <td className="px-6 py-4 text-sm font-medium">
                      <Link href={`/admin/orders/${order.id}`} className="text-blue-600 underline">
                        #{order.id.slice(-8).toUpperCase()}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-sm">{order.companyName ?? 'N/A'}</td>
                    <td className="px-6 py-4 text-sm">
                      <Badge variant={order.status === 'fulfilled' ? 'success' : order.status === 'cancelled' ? 'destructive' : 'info'}>
                        {order.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold">{formatCurrency(order.total)}</td>
                    <td className="px-6 py-4 text-sm">
                      {order.invoiceId ? (
                        <div className="space-y-1">
                          <Link href={`/admin/invoicing/${order.invoiceId}`} className="font-medium text-blue-600 underline">
                            {order.invoiceNumber}
                          </Link>
                          <div>
                            <Badge variant="outline">{order.invoiceStatus}</Badge>
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">No invoice yet</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">{formatDate(order.createdAt)}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-2">
                        <Link href={`/admin/orders/${order.id}`}>
                          <Button variant="ghost" size="sm">View Order</Button>
                        </Link>
                        {order.invoiceId ? (
                          <Link href={`/admin/invoicing/${order.invoiceId}`}>
                            <Button variant="outline" size="sm">View Invoice</Button>
                          </Link>
                        ) : order.status === 'fulfilled' ? (
                          <Link href={`/admin/invoicing/new?orderId=${order.id}`}>
                            <Button variant="outline" size="sm">Create Invoice</Button>
                          </Link>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Taster Invoice Submissions</CardTitle>
          <p className="text-sm text-muted-foreground">Submitted payment requests from tasters are tracked here for accounting.</p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Payee</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Tasting</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Receipts</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Submitted</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {tasterInvoiceSubmissions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-10 text-center text-muted-foreground">
                      No taster invoice submissions yet.
                    </td>
                  </tr>
                ) : tasterInvoiceSubmissions.map((invoice) => (
                  <tr key={invoice.id} className="transition-colors hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm font-medium">{invoice.payeeName}</p>
                        <p className="text-xs text-muted-foreground">{invoice.payeeEmail}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm font-medium">{invoice.eventName}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(invoice.scheduledAt)}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold">{formatCurrency(invoice.totalAmount)}</td>
                    <td className="px-6 py-4 text-sm">
                      {invoice.receiptUrls?.length ? (
                        <div className="space-y-1">
                          <p className="font-medium text-slate-900">{invoice.receiptUrls.length} uploaded</p>
                          <div className="flex flex-wrap gap-2">
                            {invoice.receiptUrls.slice(0, 2).map((url, index) => (
                              <a key={`${invoice.id}-receipt-${index}`} href={url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline">
                                Receipt {index + 1}
                              </a>
                            ))}
                            {invoice.receiptUrls.length > 2 ? <span className="text-xs text-slate-500">+{invoice.receiptUrls.length - 2} more</span> : null}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">None</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-2">
                        <Badge variant={tasterStatusVariant[invoice.status] ?? 'secondary'}>{invoice.status}</Badge>
                        {payoutEventMap.get(invoice.id)?.[0] ? (
                          <p className="text-xs text-muted-foreground">
                            {payoutEventMap.get(invoice.id)?.[0]?.kind === 'taster_invoice_paid' ? 'Last payout sent' : payoutEventMap.get(invoice.id)?.[0]?.kind === 'taster_invoice_approved' ? 'Approved for payout' : 'Last payout failed'}
                          </p>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">{formatDate(invoice.submittedAt)}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-2">
                        <Link href="/admin/tastings">
                          <Button variant="ghost" size="sm">View Tasting</Button>
                        </Link>
                        <Link href={`/admin/tastings/${invoice.tastingId}`}>
                          <Button variant="outline" size="sm">View Report</Button>
                        </Link>
                        {invoice.status === 'submitted' ? (
                          <form action={approveTasterInvoice}>
                            <input type="hidden" name="invoiceId" value={invoice.id} />
                            <input type="hidden" name="mode" value="admin" />
                            <Button variant="outline" size="sm" type="submit">Approve</Button>
                          </form>
                        ) : null}
                        {invoice.status !== 'paid' ? (
                          <form action={payoutTasterInvoiceViaStripe}>
                            <input type="hidden" name="invoiceId" value={invoice.id} />
                            <input type="hidden" name="mode" value="admin" />
                            <Button variant="secondary" size="sm" type="submit">{invoice.status === 'approved' ? 'Pay via Stripe' : 'Retry Payout'}</Button>
                          </form>
                        ) : null}
                      </div>
                      {payoutEventMap.get(invoice.id)?.length ? (
                        <div className="mt-2 space-y-1">
                          {payoutEventMap.get(invoice.id)?.slice(0, 2).map((event, index) => {
                            const metadata = event.metadata && typeof event.metadata === 'object' ? event.metadata as Record<string, unknown> : {}
                            const transferId = typeof metadata.stripeTransferId === 'string' ? metadata.stripeTransferId : null
                            return (
                            <p key={`${invoice.id}-${index}`} className={`text-xs ${event.kind === 'taster_invoice_payout_failed' ? 'text-red-600' : 'text-slate-500'}`}>
                              {formatDate(event.createdAt)}: {event.body || event.kind}{transferId ? ` (Transfer ${transferId})` : ''}
                            </p>
                          )})}
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
