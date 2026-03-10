import { db } from '@/db'
import { invoices, customerAccounts } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'
import { requireRole } from '@/lib/auth/session'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDate } from '@/lib/utils'
import Link from 'next/link'
import { FileText } from 'lucide-react'

export default async function CustomerInvoicesPage() {
  const session = await requireRole('customer')

  const [account] = await db.select({ id: customerAccounts.id }).from(customerAccounts).where(eq(customerAccounts.userId, session.user.id))

  const myInvoices = account ? await db
    .select()
    .from(invoices)
    .where(eq(invoices.customerId, account.id))
    .orderBy(desc(invoices.createdAt)) : []

  const statusVariant: Record<string, 'default' | 'success' | 'warning' | 'destructive' | 'info'> = {
    draft: 'default', sent: 'info', paid: 'success', overdue: 'destructive',
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Invoices</h1>
        <p className="text-muted-foreground mt-1">{myInvoices.length} invoices</p>
      </div>

      {myInvoices.length === 0 ? (
        <div className="text-center py-16">
          <FileText className="w-16 h-16 mx-auto text-slate-300 mb-4" />
          <h2 className="text-lg font-semibold">No invoices yet</h2>
          <p className="text-muted-foreground mt-1">Invoices will appear here once created by AHAWC.</p>
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full">
              <thead className="border-b bg-slate-50">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase">Invoice #</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase">Amount</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase">Status</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase">Due Date</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase">Date</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {myInvoices.map(inv => (
                  <tr key={inv.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-medium text-sm">{inv.invoiceNumber}</td>
                    <td className="px-6 py-4 text-sm font-semibold">{formatCurrency(inv.total)}</td>
                    <td className="px-6 py-4"><Badge variant={statusVariant[inv.status]}>{inv.status}</Badge></td>
                    <td className="px-6 py-4 text-sm">{inv.dueDate ? formatDate(inv.dueDate) : '—'}</td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">{formatDate(inv.createdAt)}</td>
                    <td className="px-6 py-4">
                      <Link href={`/customer/invoices/${inv.id}`}>
                        <Button variant="ghost" size="sm">
                          {inv.status !== 'paid' ? 'Pay Now' : 'View'}
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
