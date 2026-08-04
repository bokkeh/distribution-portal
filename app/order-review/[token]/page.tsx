import Link from 'next/link'
import { notFound } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { repAssistedOrders } from '@/db/schema'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { RepAssistedCustomerConfirmation } from '@/components/orders/RepAssistedCustomerConfirmation'
import { InvoiceVisual } from '@/components/invoices/InvoiceVisual'
import { getInvoiceDetailData } from '@/lib/invoices/read'
import { createInvoicePublicToken, getInvoicePublicPaymentPath } from '@/lib/invoices/public-token'
import { getRepAssistedOrderByToken } from '@/lib/orders/rep-assisted-read'
import { logActivityEvent } from '@/lib/activity/log'

export default async function RepAssistedOrderReviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const detail = await getRepAssistedOrderByToken(token)
  if (!detail) notFound()
  const invoice = await getInvoiceDetailData(detail.invoice.id)
  if (!invoice) notFound()

  if (!detail.workflow.linkOpenedAt) {
    await db.update(repAssistedOrders).set({ linkOpenedAt: new Date(), status: 'viewed', updatedAt: new Date() }).where(eq(repAssistedOrders.id, detail.workflow.id))
    await logActivityEvent({ entityType: 'order', entityId: detail.order.id, kind: 'rep_order_customer_link_opened', title: 'Customer opened secure order link', metadata: { workflowId: detail.workflow.id } })
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><Badge variant="info">Secure order review</Badge><h1 className="mt-2 text-2xl font-bold">{detail.account.companyName}</h1><p className="text-sm text-slate-500">Order #{detail.order.id.slice(-8).toUpperCase()}</p></div>{detail.account.userId ? <Link href={`/login?email=${encodeURIComponent(detail.workflow.recipientEmail)}&callbackUrl=${encodeURIComponent(`/order-review/${token}`)}`}><Button variant="outline">Sign in to portal</Button></Link> : <Link href={`/login?email=${encodeURIComponent(detail.workflow.recipientEmail)}`}><Button variant="outline">Activate or sign in</Button></Link>}</div>
        <Card><CardHeader><CardTitle>Confirm account and delivery information</CardTitle></CardHeader><CardContent><RepAssistedCustomerConfirmation token={token} account={detail.account} /></CardContent></Card>
        <InvoiceVisual invoice={invoice} />
        {detail.workflow.termsAccepted ? (
          <div className="flex flex-wrap justify-end gap-2"><Link href={`/api/invoices/public/${createInvoicePublicToken(detail.invoice.id)}/pdf`} target="_blank"><Button variant="outline">Download / print invoice</Button></Link><Link href={getInvoicePublicPaymentPath(detail.invoice.id)}><Button>Pay invoice securely</Button></Link></div>
        ) : <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Confirm your account information and terms above to continue to payment.</p>}
        <p className="text-center text-xs text-slate-500">This link is private and time-limited. Do not forward it.</p>
      </div>
    </main>
  )
}
