import { db } from '@/db'
import { invoices, customerAccounts } from '@/db/schema'
import { requireFeature } from '@/lib/auth/session'
import { and, eq, ne } from 'drizzle-orm'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { CopyPaymentLinkButton } from '@/components/invoices/CopyPaymentLinkButton'
import { CustomerRecordLink } from '@/components/crm/CustomerRecordLink'
import { getInvoicePublicPaymentPath } from '@/lib/invoices/public-token'

type AgingBucket = 'current' | '1-30' | '31-60' | '61-90' | '90+'

function getAgingBucket(dueDate: string | null): AgingBucket {
  if (!dueDate) return 'current'
  const due = new Date(dueDate)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diffDays = Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays <= 0) return 'current'
  if (diffDays <= 30) return '1-30'
  if (diffDays <= 60) return '31-60'
  if (diffDays <= 90) return '61-90'
  return '90+'
}

const BUCKET_LABELS: Record<AgingBucket, string> = {
  'current': 'Current (Not Yet Due)',
  '1-30': '1–30 Days Overdue',
  '31-60': '31–60 Days Overdue',
  '61-90': '61–90 Days Overdue',
  '90+': '90+ Days Overdue',
}

const BUCKET_COLORS: Record<AgingBucket, string> = {
  'current': 'border-emerald-200 bg-emerald-50',
  '1-30': 'border-amber-200 bg-amber-50',
  '31-60': 'border-orange-200 bg-orange-50',
  '61-90': 'border-red-200 bg-red-50',
  '90+': 'border-red-300 bg-red-100',
}

const BUCKET_TEXT: Record<AgingBucket, string> = {
  'current': 'text-emerald-700',
  '1-30': 'text-amber-700',
  '31-60': 'text-orange-700',
  '61-90': 'text-red-700',
  '90+': 'text-red-800',
}

const BUCKET_ORDER: AgingBucket[] = ['current', '1-30', '31-60', '61-90', '90+']

export default async function InvoiceAgingPage() {
  await requireFeature('invoicing', 'admin')

  const rows = await db
    .select({
      id: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      total: invoices.total,
      status: invoices.status,
      dueDate: invoices.dueDate,
      createdAt: invoices.createdAt,
      customerId: invoices.customerId,
      companyName: customerAccounts.companyName,
    })
    .from(invoices)
    .leftJoin(customerAccounts, eq(invoices.customerId, customerAccounts.id))
    .where(and(
      ne(invoices.status, 'paid'),
      ne(invoices.status, 'draft'),
    ))
    .orderBy(invoices.dueDate)

  type Row = typeof rows[0]
  const bucketed: Record<AgingBucket, Row[]> = { 'current': [], '1-30': [], '31-60': [], '61-90': [], '90+': [] }
  for (const row of rows) {
    bucketed[getAgingBucket(row.dueDate)].push(row)
  }

  const totals = Object.fromEntries(
    BUCKET_ORDER.map(b => [b, bucketed[b].reduce((s, r) => s + Number(r.total ?? 0), 0)])
  ) as Record<AgingBucket, number>

  const grandTotal = rows.reduce((s, r) => s + Number(r.total ?? 0), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/invoicing">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Accounts Receivable Aging</h1>
          <p className="mt-1 text-muted-foreground">Outstanding invoices grouped by days overdue.</p>
        </div>
      </div>

      {/* Summary buckets */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {BUCKET_ORDER.map(bucket => (
          <div key={bucket} className={`rounded-xl border p-4 ${BUCKET_COLORS[bucket]}`}>
            <p className={`text-xs font-semibold uppercase tracking-wide ${BUCKET_TEXT[bucket]}`}>
              {BUCKET_LABELS[bucket]}
            </p>
            <p className={`mt-2 text-2xl font-bold ${BUCKET_TEXT[bucket]}`}>
              {formatCurrency(totals[bucket])}
            </p>
            <p className={`mt-0.5 text-xs ${BUCKET_TEXT[bucket]} opacity-75`}>
              {bucketed[bucket].length} invoice{bucketed[bucket].length !== 1 ? 's' : ''}
            </p>
          </div>
        ))}
      </div>

      {/* Grand total */}
      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-5 py-4">
        <p className="text-sm font-semibold text-slate-700">Total Outstanding</p>
        <p className="text-2xl font-bold text-slate-900">{formatCurrency(grandTotal)}</p>
      </div>

      {/* Per-bucket tables */}
      {BUCKET_ORDER.filter(b => bucketed[b].length > 0).map(bucket => (
        <Card key={bucket}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className={`text-sm font-semibold ${BUCKET_TEXT[bucket]}`}>
                {BUCKET_LABELS[bucket]}
              </CardTitle>
              <span className={`text-sm font-bold ${BUCKET_TEXT[bucket]}`}>
                {formatCurrency(totals[bucket])}
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Invoice #</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Customer</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Amount</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Due Date</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {bucketed[bucket].map(inv => (
                    <tr key={inv.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                      <td className="px-4 py-3">
                        <Link href={`/admin/invoicing/${inv.id}`} className="font-medium text-blue-600 hover:underline">
                          {inv.invoiceNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        <CustomerRecordLink accountId={inv.customerId} name={inv.companyName ?? 'Unknown customer'} />
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900">{formatCurrency(Number(inv.total ?? 0))}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {inv.dueDate ? formatDate(inv.dueDate) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={inv.status === 'overdue' ? 'destructive' : 'warning'} className="text-[10px]">
                          {inv.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <CopyPaymentLinkButton paymentPath={getInvoicePublicPaymentPath(inv.id)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ))}

      {rows.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p className="text-lg font-semibold text-emerald-600">All caught up!</p>
            <p className="mt-1 text-sm">No outstanding invoices.</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
