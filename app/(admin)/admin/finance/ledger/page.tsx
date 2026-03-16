import { desc, eq, inArray } from 'drizzle-orm'
import Link from 'next/link'
import { db } from '@/db'
import { activityEvents, customerAccounts, invoices, journalEntries, users } from '@/db/schema'
import { requireFeature } from '@/lib/auth/session'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDate } from '@/lib/utils'

type LedgerRow = {
  id: string
  date: Date
  type: string
  reference: string
  counterparty: string
  amount: number
  detail: string
  href: string
}

export default async function FinanceLedgerPage() {
  await requireFeature('accounting', 'admin')

  const [invoiceRows, journalRows, payoutRows] = await Promise.all([
    db
      .select({
        id: invoices.id,
        createdAt: invoices.createdAt,
        invoiceNumber: invoices.invoiceNumber,
        total: invoices.total,
        status: invoices.status,
        companyName: customerAccounts.companyName,
      })
      .from(invoices)
      .leftJoin(customerAccounts, eq(invoices.customerId, customerAccounts.id))
      .orderBy(desc(invoices.createdAt))
      .limit(100),
    db
      .select({
        id: journalEntries.id,
        createdAt: journalEntries.createdAt,
        description: journalEntries.description,
        reference: journalEntries.reference,
        createdByName: users.name,
      })
      .from(journalEntries)
      .leftJoin(users, eq(journalEntries.createdBy, users.id))
      .orderBy(desc(journalEntries.createdAt))
      .limit(100),
    db
      .select()
      .from(activityEvents)
      .where(inArray(activityEvents.kind, [
        'taster_invoice_paid',
        'taster_invoice_payout_failed',
        'invoice_offline_payment_recorded',
        'invoice_credit_memo',
        'invoice_write_off',
        'invoice_void',
      ]))
      .orderBy(desc(activityEvents.createdAt))
      .limit(100),
  ])

  const rows: LedgerRow[] = [
    ...invoiceRows.map((row) => ({
      id: `invoice-${row.id}`,
      date: row.createdAt,
      type: row.status === 'paid' ? 'Invoice paid' : 'Invoice issued',
      reference: row.invoiceNumber,
      counterparty: row.companyName ?? 'Customer',
      amount: Number(row.total),
      detail: row.status === 'paid' ? 'Customer payment cleared' : 'Customer invoice created',
      href: `/admin/invoicing/${row.id}`,
    })),
    ...journalRows.map((row) => ({
      id: `journal-${row.id}`,
      date: row.createdAt,
      type: 'Journal entry',
      reference: row.reference ?? 'Manual entry',
      counterparty: row.createdByName ?? 'System',
      amount: 0,
      detail: row.description,
      href: '/admin/accounts/journal',
    })),
    ...payoutRows.map((row) => {
      const metadata = (row.metadata ?? {}) as Record<string, unknown>
      const amount = typeof metadata.amount === 'number' ? metadata.amount : Number(metadata.amount ?? 0)
      const reference = typeof metadata.tasterInvoiceId === 'string' ? metadata.tasterInvoiceId : row.id
      return {
        id: `event-${row.id}`,
        date: row.createdAt,
        type: row.kind === 'taster_invoice_paid' ? 'Taster payout' : row.kind === 'taster_invoice_payout_failed' ? 'Payout failure' : 'Invoice adjustment',
        reference,
        counterparty: row.title,
        amount,
        detail: row.body ?? row.title,
        href: '/admin/invoicing',
      }
    }),
  ].sort((a, b) => b.date.getTime() - a.date.getTime())

  return (
    <div className="space-y-6 p-4 sm:p-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Payments & Payouts Ledger</h1>
          <p className="mt-1 text-muted-foreground">A finance-facing stream of invoices, journal activity, payouts, and accounting adjustments.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/finance/reconciliation"><Button variant="outline">Reconciliation</Button></Link>
          <Link href="/admin/finance/statements"><Button variant="outline">Statements</Button></Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Ledger Activity</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full">
            <thead className="border-b bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Reference</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Counterparty</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Detail</th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 text-sm">{formatDate(row.date)}</td>
                  <td className="px-6 py-4 text-sm font-medium">{row.type}</td>
                  <td className="px-6 py-4 text-sm"><Link className="text-blue-600 hover:underline" href={row.href}>{row.reference}</Link></td>
                  <td className="px-6 py-4 text-sm">{row.counterparty}</td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">{row.detail}</td>
                  <td className="px-6 py-4 text-right text-sm font-semibold">{row.amount ? formatCurrency(row.amount) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
