import { db } from '@/db'
import { inventory, inventoryTransactions, products, users } from '@/db/schema'
import { desc, eq } from 'drizzle-orm'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { adjustStock } from '@/actions/inventory'
import { formatCurrency } from '@/lib/utils'
import Link from 'next/link'
import { Plus, AlertTriangle } from 'lucide-react'

export default async function InventoryPage() {
  const items = await db
    .select({
      id: products.id,
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
    .from(products)
    .leftJoin(inventory, eq(inventory.productId, products.id))
    .orderBy(products.name)

  const recentTransactions = await db
    .select({
      id: inventoryTransactions.id,
      type: inventoryTransactions.type,
      reason: inventoryTransactions.reason,
      deltaPaid: inventoryTransactions.deltaPaid,
      deltaSample: inventoryTransactions.deltaSample,
      deltaLooseBottlePaid: inventoryTransactions.deltaLooseBottlePaid,
      quantityPaidAfter: inventoryTransactions.quantityPaidAfter,
      quantitySampleAfter: inventoryTransactions.quantitySampleAfter,
      createdAt: inventoryTransactions.createdAt,
      productName: products.name,
      sku: products.sku,
      actorName: users.name,
    })
    .from(inventoryTransactions)
    .innerJoin(products, eq(inventoryTransactions.productId, products.id))
    .leftJoin(users, eq(inventoryTransactions.actorUserId, users.id))
    .orderBy(desc(inventoryTransactions.createdAt))
    .limit(12)

  return (
    <div className="p-4 sm:p-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Inventory</h1>
          <p className="text-muted-foreground mt-1">{items.length} products available</p>
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
                        <form action={adjustStock} className="flex items-center gap-3">
                          <input type="hidden" name="productId" value={item.productId ?? item.id} />
                          <input type="hidden" name="reorderLevel" value={item.reorderLevel ?? 10} />
                          <input type="hidden" name="looseBottlePaid" value={0} />
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              name="quantityPaid"
                              min="0"
                              defaultValue={item.quantityPaid ?? 0}
                              className={`h-8 w-20 ${isLowStock ? 'border-red-300 text-red-600' : ''}`}
                            />
                            {isLowStock && <AlertTriangle className="w-4 h-4 text-orange-500" />}
                          </div>
                          <Input
                            type="number"
                            name="quantitySample"
                            min="0"
                            defaultValue={item.quantitySample ?? 0}
                            className="h-8 w-20"
                          />
                          <Button type="submit" variant="outline" size="sm">Save</Button>
                        </form>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{item.quantitySample ?? 0}</td>
                      <td className="px-6 py-4 text-sm">{formatCurrency(item.price)}</td>
                      <td className="px-6 py-4">
                        {item.active ? <Badge variant="success">Active</Badge> : <Badge variant="secondary">Inactive</Badge>}
                      </td>
                      <td className="px-6 py-4">
                        <Link href={`/admin/inventory/${item.productId ?? item.id}`}>
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

      <Card>
        <CardContent className="p-6">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Recent Inventory Activity</h2>
            <p className="mt-1 text-sm text-muted-foreground">Latest stock movements and manual adjustments.</p>
          </div>
          <div className="space-y-3">
            {recentTransactions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No inventory activity recorded yet.</p>
            ) : recentTransactions.map(tx => (
              <div key={tx.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-slate-200 p-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">{tx.productName} <span className="text-xs font-mono text-muted-foreground">{tx.sku}</span></p>
                  <p className="mt-1 text-xs text-muted-foreground">{tx.reason ?? tx.type}</p>
                  <p className="mt-1 text-xs text-muted-foreground">By {tx.actorName ?? 'System'} • {new Date(tx.createdAt).toLocaleString()}</p>
                </div>
                <div className="text-right text-xs">
                  <p className={tx.deltaPaid === 0 ? 'text-muted-foreground' : tx.deltaPaid > 0 ? 'text-green-600' : 'text-red-600'}>
                    Paid: {tx.deltaPaid > 0 ? `+${tx.deltaPaid}` : tx.deltaPaid}
                  </p>
                  <p className={tx.deltaSample === 0 ? 'text-muted-foreground' : tx.deltaSample > 0 ? 'text-green-600' : 'text-red-600'}>
                    Sample: {tx.deltaSample > 0 ? `+${tx.deltaSample}` : tx.deltaSample}
                  </p>
                  <p className={tx.deltaLooseBottlePaid === 0 ? 'text-muted-foreground' : tx.deltaLooseBottlePaid > 0 ? 'text-green-600' : 'text-red-600'}>
                    Loose: {tx.deltaLooseBottlePaid > 0 ? `+${tx.deltaLooseBottlePaid}` : tx.deltaLooseBottlePaid}
                  </p>
                  <p className="mt-1 text-muted-foreground">After: {tx.quantityPaidAfter} paid / {tx.quantitySampleAfter} sample</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
