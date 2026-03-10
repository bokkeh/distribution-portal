import { db } from '@/db'
import { inventory, products } from '@/db/schema'
import { eq, sql } from 'drizzle-orm'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils'
import Link from 'next/link'
import { Plus, AlertTriangle } from 'lucide-react'

export default async function InventoryPage() {
  const items = await db
    .select({
      id: inventory.id,
      productId: inventory.productId,
      quantityPaid: inventory.quantityPaid,
      quantitySample: inventory.quantitySample,
      reorderLevel: inventory.reorderLevel,
      sku: products.sku,
      name: products.name,
      category: products.category,
      brand: products.brand,
      price: products.price,
      samplePrice: products.samplePrice,
      active: products.active,
    })
    .from(inventory)
    .innerJoin(products, eq(inventory.productId, products.id))
    .orderBy(products.name)

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Inventory</h1>
          <p className="text-muted-foreground mt-1">{items.length} products tracked</p>
        </div>
        <Link href="/admin/inventory/new">
          <Button><Plus className="w-4 h-4 mr-2" />Add Product</Button>
        </Link>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b bg-slate-50">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Product</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">SKU</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Paid Cases</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Sample Cases</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Price</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.length === 0 ? (
                  <tr><td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">No products in inventory. Add your first product.</td></tr>
                ) : items.map(item => {
                  const isLowStock = (item.quantityPaid ?? 0) <= (item.reorderLevel ?? 0)
                  return (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-sm font-medium">{item.name}</p>
                          {item.brand && <p className="text-xs text-muted-foreground">{item.brand}</p>}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm font-mono text-muted-foreground">{item.sku}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-semibold ${isLowStock ? 'text-red-600' : 'text-slate-900'}`}>
                            {item.quantityPaid ?? 0}
                          </span>
                          {isLowStock && <AlertTriangle className="w-4 h-4 text-orange-500" />}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm">{item.quantitySample ?? 0}</td>
                      <td className="px-6 py-4 text-sm">{formatCurrency(item.price)}</td>
                      <td className="px-6 py-4">
                        {item.active ? <Badge variant="success">Active</Badge> : <Badge variant="secondary">Inactive</Badge>}
                      </td>
                      <td className="px-6 py-4">
                        <Link href={`/admin/inventory/${item.productId}`}>
                          <Button variant="ghost" size="sm">Edit</Button>
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
