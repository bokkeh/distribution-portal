import { db } from '@/db'
import { invoices, customerAccounts } from '@/db/schema'
import { desc, eq } from 'drizzle-orm'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency, formatDate } from '@/lib/utils'
import Link from 'next/link'
import { markInvoicePaid } from '@/actions/invoices'
import { tasterInvoices, tastings, users } from '@/db/schema'
import { payoutTasterInvoiceViaStripe } from '@/actions/taster-payouts'

export default async function StaffInvoicingPage({
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
    eventName: string
    scheduledAt: Date
  }> = []

  const allInvoices = await db
    .select({
      id: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
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
        eventName: tastings.eventName,
        scheduledAt: tastings.scheduledAt,
      })
      .from(tasterInvoices)
      .innerJoin(tastings, eq(tasterInvoices.tastingId, tastings.id))
      .innerJoin(users, eq(tasterInvoices.submittedByUserId, users.id))
      .orderBy(desc(tasterInvoices.submittedAt))
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()
    if (!message.includes('taster_invoices') && !message.includes('does not exist')) {
      throw error
    }
  }

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
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Invoicing</h1>
        <p className="text-muted-foreground mt-1">Review invoices and mark payments received.</p>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Invoice #</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Customer</th>
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
                    <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">No invoices found.</td>
                  </tr>
                ) : allInvoices.map((inv) => (
                  <tr key={inv.id} className="transition-colors hover:bg-slate-50">
                    <td className="px-6 py-4 text-sm font-medium">{inv.invoiceNumber}</td>
                    <td className="px-6 py-4 text-sm">{inv.companyName ?? 'N/A'}</td>
                    <td className="px-6 py-4 text-sm font-semibold">{formatCurrency(inv.total)}</td>
                    <td className="px-6 py-4"><Badge variant={statusVariant[inv.status]}>{inv.status}</Badge></td>
                    <td className="px-6 py-4 text-sm">{inv.dueDate ? formatDate(inv.dueDate) : '—'}</td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">{formatDate(inv.createdAt)}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-2">
                        <Link href={`/staff/invoicing/${inv.id}`}>
                          <Button variant="ghost" size="sm">View</Button>
                        </Link>
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

      <Card>
        <CardHeader>
          <CardTitle>Taster Invoice Submissions</CardTitle>
          <p className="text-sm text-muted-foreground">Submitted tasting invoices can be paid out via Stripe once the taster has connected payouts.</p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Payee</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Tasting</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Submitted</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {tasterInvoiceSubmissions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-muted-foreground">No taster invoice submissions yet.</td>
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
                    <td className="px-6 py-4"><Badge variant={tasterStatusVariant[invoice.status] ?? 'secondary'}>{invoice.status}</Badge></td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">{formatDate(invoice.submittedAt)}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-2">
                        <Link href={`/taster/tastings/${invoice.tastingId}`}>
                          <Button variant="outline" size="sm">View Report</Button>
                        </Link>
                        {invoice.status !== 'paid' ? (
                          <form action={payoutTasterInvoiceViaStripe}>
                            <input type="hidden" name="invoiceId" value={invoice.id} />
                            <input type="hidden" name="mode" value="staff" />
                            <Button variant="secondary" size="sm" type="submit">Pay via Stripe</Button>
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
    </div>
  )
}
