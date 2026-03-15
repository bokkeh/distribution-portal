import Link from 'next/link'
import { and, desc, eq, isNull } from 'drizzle-orm'
import { db } from '@/db'
import { tasterInvoices, tastings } from '@/db/schema'
import { requireFeature } from '@/lib/auth/session'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

function asNumber(value: string | null | undefined) {
  return Number(value ?? '0')
}

export default async function TasterPayoutsPage() {
  const session = await requireFeature('tastings', 'taster', 'admin')
  const userId = session.user.id

  const [invoiceRows, missingInvoiceRows] = await Promise.all([
    db
      .select({
        id: tasterInvoices.id,
        tastingId: tasterInvoices.tastingId,
        eventName: tastings.eventName,
        scheduledAt: tastings.scheduledAt,
        totalAmount: tasterInvoices.totalAmount,
        status: tasterInvoices.status,
        submittedAt: tasterInvoices.submittedAt,
      })
      .from(tasterInvoices)
      .innerJoin(tastings, eq(tasterInvoices.tastingId, tastings.id))
      .where(eq(tasterInvoices.submittedByUserId, userId))
      .orderBy(desc(tasterInvoices.submittedAt)),
    db
      .select({
        id: tastings.id,
        eventName: tastings.eventName,
        scheduledAt: tastings.scheduledAt,
      })
      .from(tastings)
      .leftJoin(tasterInvoices, eq(tasterInvoices.tastingId, tastings.id))
      .where(and(eq(tastings.assignedUserId, userId), eq(tastings.status, 'completed'), isNull(tasterInvoices.id)))
      .orderBy(desc(tastings.scheduledAt)),
  ])

  const totalPaid = invoiceRows.filter(row => row.status === 'paid').reduce((sum, row) => sum + asNumber(row.totalAmount), 0)
  const totalUpcoming = invoiceRows.filter(row => inArrayValue(row.status, ['submitted', 'approved'])).reduce((sum, row) => sum + asNumber(row.totalAmount), 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">My Payouts</h1>
        <p className="mt-1 text-muted-foreground">Track paid invoices, upcoming payouts, and any tastings still missing an invoice.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-slate-500">Total Paid Out</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold text-emerald-600">${totalPaid.toFixed(2)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-slate-500">Upcoming Payouts</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold text-blue-600">${totalUpcoming.toFixed(2)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-slate-500">Missing Invoices</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold text-amber-600">{missingInvoiceRows.length}</p></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Invoice Reminders</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {missingInvoiceRows.length ? missingInvoiceRows.map(tasting => (
            <div key={tasting.id} className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-slate-900">{tasting.eventName}</p>
                <p className="text-sm text-slate-600">{new Date(tasting.scheduledAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</p>
              </div>
              <Link href={`/taster/tastings/${tasting.id}#invoice`}>
                <Button>Submit Missing Invoice</Button>
              </Link>
            </div>
          )) : (
            <p className="text-sm text-slate-500">No missing invoices. Everything completed has an invoice on file.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Invoice History</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {invoiceRows.length ? invoiceRows.map(invoice => (
            <div key={invoice.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-slate-900">{invoice.eventName}</p>
                  <Badge variant={invoice.status === 'paid' ? 'success' : invoice.status === 'approved' ? 'info' : 'secondary'}>
                    {invoice.status}
                  </Badge>
                </div>
                <p className="text-sm text-slate-500">
                  Submitted {new Date(invoice.submittedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <p className="text-lg font-bold text-slate-900">${asNumber(invoice.totalAmount).toFixed(2)}</p>
                <Link href={`/taster/tastings/${invoice.tastingId}#invoice`}>
                  <Button variant="outline" size="sm">View Invoice</Button>
                </Link>
              </div>
            </div>
          )) : (
            <p className="text-sm text-slate-500">No invoices submitted yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function inArrayValue(value: string, set: string[]) {
  return set.includes(value)
}
