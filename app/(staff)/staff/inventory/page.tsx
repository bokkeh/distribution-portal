import { db } from '@/db'
import { inventory, products } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils'
import { AlertTriangle } from 'lucide-react'

export default async function StaffInventoryPage() {
  const items = await db
    .select({
      quantityPaid: inventory.quantityPaid, quantitySample: inventory.quantitySample, reorderLevel: inventory.reorderLevel,
      sku: products.sku, name: products.name, category: products.category, brand: products.brand, price: products.price,
    })
    .from(inventory)
    .innerJoin(products, eq(inventory.productId, products.id))
    .orderBy(products.name)

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Inventory (Read Only)</h1>
        <p className="text-muted-foreground mt-1">Current stock levels across all products</p>
      </div>
      <Card>
        <CardContent className="p-0">
          <table className="w-full">
            <thead className="border-b bg-slate-50">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase">Product</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase">SKU</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase">Paid Cases</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase">Sample Cases</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase">Price</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((item, i) => {
                const isLow = (item.quantityPaid ?? 0) <= (item.reorderLevel ?? 0)
                return (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium">{item.name}</p>
                      {item.brand && <p className="text-xs text-muted-foreground">{item.brand}</p>}
                    </td>
                    <td className="px-6 py-4 text-sm font-mono text-muted-foreground">{item.sku}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-semibold ${isLow ? 'text-red-600' : ''}`}>{item.quantityPaid ?? 0}</span>
                        {isLow && <AlertTriangle className="w-4 h-4 text-orange-500" />}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm">{item.quantitySample ?? 0}</td>
                    <td className="px-6 py-4 text-sm">{formatCurrency(item.price)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
