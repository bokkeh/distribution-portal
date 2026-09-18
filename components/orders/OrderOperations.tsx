import { desc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { orders, orderDocuments, users } from '@/db/schema'
import { requireFeature } from '@/lib/auth/session'
import { OrderDeliveryDateForm } from './OrderDeliveryDateForm'
import { OrderPoUpload } from './OrderPoUpload'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export async function OrderOperations({ orderId, paymentTerms, orderDate }: { orderId: string; paymentTerms: string | null; orderDate: Date }) {
  await requireFeature('orders', 'admin', 'staff')
  const [[order], documents] = await Promise.all([
    db.select({ deliveryDate: orders.deliveryDate }).from(orders).where(eq(orders.id, orderId)).limit(1),
    db.select({ id: orderDocuments.id, fileName: orderDocuments.fileName, uploadedAt: orderDocuments.uploadedAt, uploadedBy: users.name })
      .from(orderDocuments).leftJoin(users, eq(orderDocuments.uploadedByUserId, users.id))
      .where(eq(orderDocuments.orderId, orderId)).orderBy(desc(orderDocuments.uploadedAt)),
  ])
  if (!order) return null
  return <Card><CardHeader><CardTitle>Delivery &amp; Purchase Order</CardTitle></CardHeader><CardContent className="space-y-4">
    <p className="text-sm text-slate-600">Order Date: {orderDate.toLocaleDateString('en-US', { timeZone: 'America/New_York' })}</p>
    <OrderDeliveryDateForm key={order.deliveryDate ?? 'blank'} orderId={orderId} deliveryDate={order.deliveryDate} paymentTerms={paymentTerms} />
    <section className="space-y-3 border-t pt-4" aria-label="Purchase Order / PO">
      <h3 className="font-semibold">Purchase Order / PO</h3>
      {documents.length ? <ul className="divide-y">{documents.map(document => <li key={document.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
        <div className="min-w-0"><a className="break-all font-medium text-blue-600 hover:underline" href={`/api/orders/${orderId}/po/${document.id}`} target="_blank" rel="noopener noreferrer">{document.fileName}</a>
          <p className="text-xs text-slate-500">{document.uploadedAt.toLocaleString('en-US', { timeZone: 'America/New_York' })} ET · {document.uploadedBy ?? 'Former user'}</p></div>
        <a className="text-blue-600 hover:underline" href={`/api/orders/${orderId}/po/${document.id}?download=1`}>Download</a>
      </li>)}</ul> : <p className="text-sm text-slate-500">No PO attached.</p>}
      <OrderPoUpload orderId={orderId} />
    </section>
  </CardContent></Card>
}
