import { notFound } from 'next/navigation'
import { getRepAssistedOrderDetail } from '@/actions/rep-assisted-orders'
import { RepAssistedOrderActions } from '@/components/orders/RepAssistedOrderActions'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency, formatDate } from '@/lib/utils'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default async function RepAssistedOrderDetailPage({ params }: { params: Promise<{ workflowId: string }> }) {
  const { workflowId } = await params
  const detail = await getRepAssistedOrderDetail(workflowId)
  if (!detail) notFound()
  const { workflow, account, order, invoice } = detail
  const errors = workflow.notificationErrors as Record<string, string>
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><h1 className="text-2xl font-bold">{account?.companyName ?? 'Rep-assisted draft'}</h1><Badge>{workflow.status.replaceAll('_', ' ')}</Badge></div><p className="text-sm text-muted-foreground">Created {formatDate(workflow.createdAt)}</p></div>{workflow.status === 'draft' || workflow.status === 'failed' ? <Link href={`/sales/orders/assisted/new?draft=${workflow.id}`}><Button>Resume draft</Button></Link> : null}</div>
      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardHeader><CardTitle className="text-base">Order</CardTitle></CardHeader><CardContent><p className="font-semibold">{order ? `#${order.id.slice(-8).toUpperCase()}` : 'Not created'}</p><p className="text-sm text-slate-500">{order ? formatCurrency(Number(order.total)) : 'Recoverable draft'}</p></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-base">Invoice</CardTitle></CardHeader><CardContent><p className="font-semibold">{invoice?.invoiceNumber ?? 'Not created'}</p><p className="text-sm text-slate-500">{invoice?.status ?? 'draft'}</p></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-base">Customer activity</CardTitle></CardHeader><CardContent><p className="text-sm">Link: {workflow.linkOpenedAt ? `opened ${formatDate(workflow.linkOpenedAt)}` : 'not opened'}</p><p className="text-sm">Invoice: {workflow.invoiceViewedAt ? 'viewed' : 'not viewed'}</p></CardContent></Card>
      </div>
      <Card><CardHeader><CardTitle>Notifications</CardTitle></CardHeader><CardContent className="space-y-3"><p className="text-sm">Email to <strong>{workflow.recipientEmail}</strong>: {workflow.emailStatus}</p><p className="text-sm">SMS to <strong>{workflow.recipientPhone}</strong>: {workflow.smsStatus}</p>{Object.entries(errors).map(([channel, message]) => <p key={channel} className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{channel}: {message}</p>)}<RepAssistedOrderActions workflowId={workflow.id} canCancel={invoice?.status !== 'paid' && workflow.status !== 'cancelled'} /></CardContent></Card>
      {workflow.internalNotes ? <Card><CardHeader><CardTitle>Internal notes</CardTitle></CardHeader><CardContent className="whitespace-pre-wrap text-sm">{workflow.internalNotes}</CardContent></Card> : null}
    </div>
  )
}
