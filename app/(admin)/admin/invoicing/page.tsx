import { db } from '@/db'
import { invoices, customerAccounts, tasterInvoices, tastings, users } from '@/db/schema'
import { desc, eq } from 'drizzle-orm'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency, formatDate } from '@/lib/utils'
import Link from 'next/link'
import { Plus } from 'lucide-react'

export default async function InvoicingPage() {
  let tasterInvoiceSubmissions: Array<{
    id: string
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Invoicing</h1>
          <p className="text-muted-foreground mt-1">Manage and track all invoices</p>
        </div>
        <Link href="/admin/invoicing/new">
          <Button><Plus className="w-4 h-4 mr-2" />New Invoice</Button>
        </Link>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b bg-slate-50">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Invoice #</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Customer</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Amount</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Due Date</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Created</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {allInvoices.length === 0 ? (
                  <tr><td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">No invoices yet. Create your first invoice.</td></tr>
                ) : allInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-sm">{inv.invoiceNumber}</td>
                    <td className="px-6 py-4 text-sm">{inv.companyName ?? 'N/A'}</td>
                    <td className="px-6 py-4 text-sm font-semibold">{formatCurrency(inv.total)}</td>
                    <td className="px-6 py-4"><Badge variant={statusVariant[inv.status]}>{inv.status}</Badge></td>
                    <td className="px-6 py-4 text-sm">{inv.dueDate ? formatDate(inv.dueDate) : '—'}</td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">{formatDate(inv.createdAt)}</td>
                    <td className="px-6 py-4">
                      <Link href={`/admin/invoicing/${inv.id}`}>
                        <Button variant="ghost" size="sm">View</Button>
                      </Link>
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
                  <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Payee</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Tasting</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Amount</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Submitted</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {tasterInvoiceSubmissions.length === 0 ? (
                  <tr><td colSpan={6} className="px-6 py-10 text-center text-muted-foreground">No taster invoice submissions yet.</td></tr>
                ) : tasterInvoiceSubmissions.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-slate-50 transition-colors">
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
                      <Link href="/admin/tastings">
                        <Button variant="ghost" size="sm">View Tasting</Button>
                      </Link>
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
