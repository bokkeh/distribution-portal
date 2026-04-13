import Image from 'next/image'
import { Megaphone } from 'lucide-react'
import { getPromotionCatalogAdminData } from '@/actions/promotion-catalog'
import { PromotionCatalogCreateForm } from '@/components/promotions/PromotionCatalogCreateForm'
import { PromotionCatalogOrderStatusForm } from '@/components/promotions/PromotionCatalogOrderStatusForm'
import { PromotionCatalogPublishForm } from '@/components/promotions/PromotionCatalogPublishForm'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { formatPromotionCategory, formatPromotionOrderStatus, promotionStatusBadgeVariant } from '@/lib/promotions'
import { formatCurrency, formatDate } from '@/lib/utils'

export default async function AdminPromotionCatalogPage() {
  const data = await getPromotionCatalogAdminData()
  const items = data.items ?? []
  const orders = data.orders ?? []
  const accounts = data.accounts ?? []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Promotion Catalog</h1>
        <p className="mt-1 text-sm text-slate-500">Upload marketing assets, publish them to accounts, and manage signage/material requests through delivery.</p>
      </div>

      {'missingTable' in data && data.missingTable ? (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-6 text-sm text-amber-900">
            Promotion catalog tables are not in the database yet. Run <strong>npm run db:push</strong> before using this feature.
          </CardContent>
        </Card>
      ) : null}

      <PromotionCatalogCreateForm />

      <Card>
        <CardHeader>
          <CardTitle>Catalog Items</CardTitle>
          <CardDescription>{items.length} items available to publish to customer accounts.</CardDescription>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <EmptyState icon={Megaphone} title="No promotion catalog items yet" description="Create the first item above to start sending signage and marketing options to accounts." />
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {items.map((item) => (
                <Card key={item.id} className="overflow-hidden border-slate-200">
                  <div className="grid gap-0 md:grid-cols-[220px_1fr]">
                    <div className="relative min-h-[200px] bg-slate-100">
                      <Image src={item.imageUrl} alt={item.title} fill className="object-cover" unoptimized />
                    </div>
                    <div className="p-5">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="info">{formatPromotionCategory(item.category)}</Badge>
                        {item.isCustomizable ? <Badge variant="outline">Customizable</Badge> : null}
                        <Badge variant={item.isActive ? 'success' : 'outline'}>{item.isActive ? 'Active' : 'Inactive'}</Badge>
                      </div>
                      <h3 className="mt-3 text-lg font-semibold text-slate-900">{item.title}</h3>
                      <p className="mt-2 text-sm text-slate-500">{item.description || 'No description added yet.'}</p>
                      <div className="mt-4 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                        <p><span className="font-medium text-slate-900">Price:</span> {formatCurrency(item.price)}</p>
                        <p><span className="font-medium text-slate-900">Lead time:</span> {item.leadTimeDays ? `${item.leadTimeDays} days` : 'Not set'}</p>
                        <p><span className="font-medium text-slate-900">Fulfillment:</span> {item.fulfillmentType}</p>
                        <p><span className="font-medium text-slate-900">Published:</span> {item.publicationCount} account{item.publicationCount === 1 ? '' : 's'}</p>
                      </div>
                      <div className="mt-4 border-t border-slate-200 pt-4">
                        <PromotionCatalogPublishForm itemId={item.id} accounts={accounts} />
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Promotion Requests Log</CardTitle>
          <CardDescription>Track which accounts need signage or marketing support created and delivered.</CardDescription>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <EmptyState title="No promotion requests yet" description="Customer requests and delivery tracking will appear here once accounts start ordering from the catalog." />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Account</th>
                    <th className="px-3 py-2">Item</th>
                    <th className="px-3 py-2">Qty</th>
                    <th className="px-3 py-2">Total</th>
                    <th className="px-3 py-2">Rep</th>
                    <th className="px-3 py-2">Requested</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Delivery</th>
                    <th className="px-3 py-2">Update</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id} className="border-b border-slate-100 align-top">
                      <td className="px-3 py-3 font-medium text-slate-900">{order.accountName}</td>
                      <td className="px-3 py-3 text-slate-700">{order.itemTitle}</td>
                      <td className="px-3 py-3 text-slate-700">{order.quantity}</td>
                      <td className="px-3 py-3 text-slate-700">{formatCurrency(order.totalPrice)}</td>
                      <td className="px-3 py-3 text-slate-700">{order.repName ?? 'Unassigned'}</td>
                      <td className="px-3 py-3 text-slate-700">{formatDate(order.requestedAt)}</td>
                      <td className="px-3 py-3"><Badge variant={promotionStatusBadgeVariant(order.status)}>{formatPromotionOrderStatus(order.status)}</Badge></td>
                      <td className="px-3 py-3 text-slate-700">{order.deliveredAt ? formatDate(order.deliveredAt) : 'Pending'}</td>
                      <td className="px-3 py-3 min-w-[210px]"><PromotionCatalogOrderStatusForm orderId={order.id} currentStatus={order.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
