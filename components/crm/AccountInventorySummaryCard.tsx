import Link from 'next/link'
import { Package2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type InventoryPreviewItem = {
  id: string
  productName: string
  sku: string
  quantityOnHand: string
}

export function AccountInventorySummaryCard({
  items,
  totalUnits,
  href,
}: {
  items: InventoryPreviewItem[]
  totalUnits: number
  href: string
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2">
          <Package2 className="h-4 w-4" />
          Inventory
        </CardTitle>
        <Link href={href} className="text-xs font-medium text-blue-600 hover:underline">View full tab</Link>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Total inventory on hand</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{totalUnits.toFixed(2)}</p>
        </div>
        {items.length === 0 ? (
          <p className="text-sm text-slate-500">No account inventory tracked yet.</p>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-3 text-sm">
                <div>
                  <p className="font-medium text-slate-900">{item.productName}</p>
                  <p className="text-xs text-slate-500">{item.sku}</p>
                </div>
                <p className="font-semibold text-slate-900">{item.quantityOnHand}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
