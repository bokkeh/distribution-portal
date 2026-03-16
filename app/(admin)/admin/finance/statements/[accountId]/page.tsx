import { asc, eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { db } from '@/db'
import { customerAccounts, invoices } from '@/db/schema'
import { requireFeature } from '@/lib/auth/session'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency, formatDate } from '@/lib/utils'

export default async function FinanceStatementDetailPage({
  params,
}: {
  params: Promise<{ accountId: string }>
}) {
  await requireFeature('accounting', 'admin')
  const { accountId } = await params

  const [account] = await db.select().from(customerAccounts).where(eq(customerAccounts.id, accountId)).limit(1)
  if (!account) notFound()

  const statementInvoices = await db
    .select({
      id: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      total: invoices.total,
      status: invoices.status,
      dueDate: invoices.dueDate,
      createdAt: invoices.createdAt,
      paidAt: invoices.paidAt,
    })
    .from(invoices)
    .where(eq(invoices.customerId, account.id))
    .orderBy(asc(invoices.createdAt))

  const openBalance = statementInvoices
    .filter((invoice) => invoice.status !== 'paid')
    .reduce((sum, invoice) => sum + Number(invoice.total), 0)

  return (
    <div className="space-y-6 p-4 sm:p-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{account.companyName}</h1>
        <p className="mt-1 text-muted-foreground">Statement view for customer balances and invoice history.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardContent className="p-6"><p className="text-sm text-muted-foreground">Open Balance</p><p className="mt-2 text-2xl font-bold">{formatCurrency(openBalance)}</p></CardContent></Card>
        <Card><CardContent className="p-6"><p className="text-sm text-muted-foreground">Invoices</p><p className="mt-2 text-2xl font-bold">{statementInvoices.length}</p></CardContent></Card>
        <Card><CardContent className="p-6"><p className="text-sm text-muted-foreground">Payment Terms</p><p className="mt-2 text-2xl font-bold">{account.paymentTerms ?? 'NET30'}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Statement Activity</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full">
            <thead className="border-b bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Invoice</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Issued</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Due</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {statementInvoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td className="px-6 py-4 text-sm font-medium">{invoice.invoiceNumber}</td>
                  <td className="px-6 py-4 text-sm">{formatDate(invoice.createdAt)}</td>
                  <td className="px-6 py-4 text-sm">{invoice.dueDate ? formatDate(invoice.dueDate) : '—'}</td>
                  <td className="px-6 py-4 text-sm">{invoice.status === 'paid' && invoice.paidAt ? `Paid ${formatDate(invoice.paidAt)}` : invoice.status}</td>
                  <td className="px-6 py-4 text-right text-sm font-semibold">{formatCurrency(invoice.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
