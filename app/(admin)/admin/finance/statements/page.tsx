import { desc, eq, sql } from 'drizzle-orm'
import Link from 'next/link'
import { db } from '@/db'
import { customerAccounts, invoices } from '@/db/schema'
import { requireFeature } from '@/lib/auth/session'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'

export default async function FinanceStatementsPage() {
  await requireFeature('accounting', 'admin')

  const accounts = await db
    .select({
      id: customerAccounts.id,
      companyName: customerAccounts.companyName,
      balance: sql<string>`COALESCE(SUM(CASE WHEN ${invoices.status} <> 'paid' THEN ${invoices.total} ELSE 0 END), 0)`,
      openInvoiceCount: sql<number>`COUNT(CASE WHEN ${invoices.status} <> 'paid' THEN 1 END)`,
    })
    .from(customerAccounts)
    .leftJoin(invoices, eq(customerAccounts.id, invoices.customerId))
    .groupBy(customerAccounts.id)
    .orderBy(desc(sql`COALESCE(SUM(CASE WHEN ${invoices.status} <> 'paid' THEN ${invoices.total} ELSE 0 END), 0)`))

  return (
    <div className="space-y-6 p-4 sm:p-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Customer Statements</h1>
        <p className="mt-1 text-muted-foreground">Open balances, invoice counts, and statement drill-down by customer account.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Accounts</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {accounts.map((account) => (
            <div key={account.id} className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-slate-900">{account.companyName}</p>
                <p className="text-xs text-muted-foreground">{account.openInvoiceCount} open invoices</p>
              </div>
              <div className="flex items-center gap-3">
                <p className="text-sm font-semibold">{formatCurrency(account.balance)}</p>
                <Link href={`/admin/finance/statements/${account.id}`}>
                  <Button variant="outline" size="sm">Open Statement</Button>
                </Link>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
