import Image from 'next/image'
import { Megaphone } from 'lucide-react'
import { getPromotionCatalogCustomerData } from '@/actions/promotion-catalog'
import { PromotionCatalogRequestForm } from '@/components/promotions/PromotionCatalogRequestForm'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { formatPromotionCategory, formatPromotionOrderStatus, promotionStatusBadgeVariant } from '@/lib/promotions'
import { formatCurrency, formatDate } from '@/lib/utils'

export default async function CustomerPromotionCatalogPage() {
  const data = await getPromotionCatalogCustomerData()
  const items = data.items ?? []
  const orders = data.orders ?? []

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-blue-50">
        <div className="grid gap-6 px-6 py-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8">
          <div className="space-y-3">
            <Badge variant="info">Promotion Catalog</Badge>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Promotion Catalog</h1>
              <p className="mt-1 text-sm text-slate-500">Request signage, menu placements, social assets, and other promotional support approved for your account.</p>
            </div>
          </div>
          <Card className="border-slate-200 bg-white/90 shadow-sm">
            <CardContent className="p-6">
              <p className="text-sm font-semibold text-slate-900">Ordering support materials</p>
              <p className="mt-2 text-sm text-slate-500">Submit requests from this catalog and your AHAWC rep plus the admin team will be notified to create and deliver the materials.</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {'missingTable' in data && data.missingTable ? (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-6 text-sm text-amber-900">
            Promotion catalog tables are not in the database yet. Run <strong>npm run db:push</strong> before using this feature.
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Available to {data.companyName ?? 'Your Account'}</CardTitle>
          <CardDescription>Only items published to your account appear here.</CardDescription>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <EmptyState icon={Megaphone} title="No promotion items available yet" description="Your rep has not published any catalog items to your account yet." />
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {items.map((item) => (
                <Card key={item.availabilityId} className="overflow-hidden border-slate-200">
                  <div className="grid gap-0 md:grid-cols-[220px_1fr]">
                    <div className="relative min-h-[200px] bg-slate-100">
                      <Image src={item.imageUrl} alt={item.title} fill className="object-cover" unoptimized />
                    </div>
                    <div className="p-5">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="info">{formatPromotionCategory(item.category)}</Badge>
                        {item.repRecommended ? <Badge variant="success">Rep Recommended</Badge> : null}
                        {item.isCustomizable ? <Badge variant="outline">Customizable</Badge> : null}
                      </div>
                      <h3 className="mt-3 text-lg font-semibold text-slate-900">{item.title}</h3>
                      <p className="mt-2 text-sm text-slate-500">{item.description || 'No description added yet.'}</p>
                      <div className="mt-4 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                        <p><span className="font-medium text-slate-900">Price:</span> {formatCurrency(item.price)}</p>
                        <p><span className="font-medium text-slate-900">Lead time:</span> {item.leadTimeDays ? `${item.leadTimeDays} days` : 'Not set'}</p>
                      </div>
                      <div className="mt-4 border-t border-slate-200 pt-4">
                        <PromotionCatalogRequestForm itemId={item.itemId} />
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
          <CardTitle>My Promotion Requests</CardTitle>
          <CardDescription>Track what has been requested, created, and delivered for your account.</CardDescription>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <EmptyState title="No requests yet" description="Requests submitted from the catalog will appear here." />
          ) : (
            <div className="space-y-3">
              {orders.map((order) => (
                <div key={order.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{order.itemTitle}</p>
                      <p className="mt-1 text-sm text-slate-500">Requested {formatDate(order.requestedAt)} • Qty {order.quantity}</p>
                    </div>
                    <div className="text-right">
                      <Badge variant={promotionStatusBadgeVariant(order.status)}>{formatPromotionOrderStatus(order.status)}</Badge>
                      <p className="mt-2 text-sm font-medium text-slate-900">{formatCurrency(order.totalPrice)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
