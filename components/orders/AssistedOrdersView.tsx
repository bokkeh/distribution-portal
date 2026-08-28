import Link from 'next/link'
import { Plus } from 'lucide-react'
import { listRepAssistedOrders } from '@/actions/rep-assisted-orders'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency, formatDate } from '@/lib/utils'

const statusVariants: Record<string, 'secondary' | 'success' | 'warning' | 'destructive' | 'info'> = {
  draft: 'secondary', ready_to_send: 'info', sent: 'info', viewed: 'warning', awaiting_payment: 'warning',
  paid: 'success', failed: 'destructive', cancelled: 'destructive', expired: 'secondary',
}

export async function AssistedOrdersView() {
  const rows = await listRepAssistedOrders()
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-lg font-semibold text-slate-900">Rep-assisted orders</h2><p className="text-sm text-muted-foreground">Track customer notifications, invoice views, and payment status.</p></div>
        <Link href="/sales/orders/assisted/new"><Button><Plus className="mr-2 h-4 w-4" />Create order</Button></Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        {['draft', 'awaiting_payment', 'paid', 'failed'].map((status) => <Card key={status}><CardContent className="p-4"><p className="text-xs uppercase text-slate-500">{status.replaceAll('_', ' ')}</p><p className="mt-1 text-2xl font-bold">{rows.filter((row) => row.workflow.status === status).length}</p></CardContent></Card>)}
      </div>
      <Card>
        <CardHeader><CardTitle>Orders</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {rows.length ? rows.map(({ workflow, account, order, invoice }) => (
            <Link key={workflow.id} href={`/sales/orders/assisted/${workflow.id}`} className="grid gap-3 rounded-xl border border-slate-200 p-4 transition-colors hover:bg-slate-50 md:grid-cols-[1.4fr_0.8fr_0.8fr_1fr_auto] md:items-center">
              <div><p className="font-semibold">{account?.companyName ?? 'Recoverable draft'}</p><p className="text-xs text-slate-500">Created {formatDate(workflow.createdAt)}</p></div>
              <div><p className="text-xs text-slate-500">Order</p><p className="text-sm font-medium">{order ? `#${order.id.slice(-8).toUpperCase()}` : 'Not created'}</p></div>
              <div><p className="text-xs text-slate-500">Invoice</p><p className="text-sm font-medium">{invoice?.invoiceNumber ?? 'Not created'}</p></div>
              <div><p className="text-sm font-semibold">{order ? formatCurrency(Number(order.total)) : 'Draft'}</p><p className="text-xs text-slate-500">Email {workflow.emailStatus} · SMS {workflow.smsStatus}</p></div>
              <Badge variant={statusVariants[workflow.status] ?? 'secondary'}>{workflow.status.replaceAll('_', ' ')}</Badge>
            </Link>
          )) : <p className="py-8 text-center text-sm text-slate-500">No rep-assisted orders yet.</p>}
        </CardContent>
      </Card>
    </div>
  )
}
