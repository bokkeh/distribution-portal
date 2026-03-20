import { db } from '@/db'
import { inventory, inventoryTransactions, inventorySampleHolders, products, users } from '@/db/schema'
import { asc, desc, eq, inArray } from 'drizzle-orm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils'
import Link from 'next/link'
import { Plus, AlertTriangle } from 'lucide-react'
import { AdminInventoryRowActions } from '@/components/inventory/AdminInventoryRowActions'
import SampleHoldersPanel from '@/components/inventory/SampleHoldersPanel'

export default async function InventoryPage() {
  // Fetch staff/admin users for the assign dropdown
  const staffUsers = await db
    .select({ id: users.id, name: users.name, role: users.role })
    .from(users)
    .where(inArray(users.role, ['admin', 'staff']))
    .orderBy(asc(users.name))

  // Fetch all current sample holders
  const sampleHolders = await db
    .select({
      id: inventorySampleHolders.id,
      productId: inventorySampleHolders.productId,
      userId: inventorySampleHolders.userId,
      quantity: inventorySampleHolders.quantity,
      notes: inventorySampleHolders.notes,
      checkedOutAt: inventorySampleHolders.checkedOutAt,
      productName: products.name,
      userName: users.name,
    })
    .from(inventorySampleHolders)
    .innerJoin(products, eq(inventorySampleHolders.productId, products.id))
    .innerJoin(users, eq(inventorySampleHolders.userId, users.id))
    .orderBy(asc(products.name), asc(users.name))

  const items = await db
    .select({
      id: products.id,
      productId: inventory.productId,
      quantityPaid: inventory.quantityPaid,
      quantitySample: inventory.quantitySample,
      looseBottlePaid: inventory.looseBottlePaid,
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

  let recentTransactions: Array<{
    id: string
    type: string
    reason: string | null
    deltaPaid: number
    deltaSample: number
    deltaLooseBottlePaid: number
    quantityPaidAfter: number
    quantitySampleAfter: number
    createdAt: Date
    productName: string
    sku: string
    actorName: string | null
  }> = []
  let inventoryHistoryUnavailable = false

  try {
    recentTransactions = await db
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
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : ''
    const code = (error as { code?: string; cause?: { code?: string } } | null)?.code
      ?? (error as { cause?: { code?: string } } | null)?.cause?.code
    if (code === '42P01' || message.includes('inventory_transactions')) {
      inventoryHistoryUnavailable = true
    } else {
      throw error
    }
  }

  const lowStockItems = items.filter(item =>
    item.active &&
    item.reorderLevel != null &&
    (item.quantityPaid ?? 0) <= (item.reorderLevel ?? 0)
  )

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

      {lowStockItems.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-amber-800">
                {lowStockItems.length} product{lowStockItems.length !== 1 ? 's' : ''} at or below reorder level
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {lowStockItems.map(item => (
                  <span key={item.id} className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-white px-2.5 py-1 text-xs font-medium text-amber-900">
                    <span className="font-semibold">{item.name}</span>
                    <span className="text-amber-600">
                      {item.quantityPaid ?? 0} case{(item.quantityPaid ?? 0) !== 1 ? 's' : ''} left
                      {item.reorderLevel != null && ` (min ${item.reorderLevel})`}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

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
                  <th className="text-right px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Actions</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Price</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.length === 0 ? (
                  <tr><td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">No products in inventory. Add your first product.</td></tr>
                ) : items.map(item => {
                  return (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm font-medium">{item.name}</p>
                          {item.brand && <p className="text-xs text-muted-foreground">{item.brand}</p>}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm font-mono text-muted-foreground">{item.sku}</td>
                      <AdminInventoryRowActions
                        productId={item.productId ?? item.id}
                        quantityPaid={item.quantityPaid ?? 0}
                        quantitySample={item.quantitySample ?? 0}
                        looseBottlePaid={item.looseBottlePaid ?? 0}
                        reorderLevel={item.reorderLevel ?? 10}
                      />
                      <td className="px-6 py-4 text-sm">{formatCurrency(item.price)}</td>
                      <td className="px-6 py-4">
                        {item.active ? <Badge variant="success">Active</Badge> : <Badge variant="secondary">Inactive</Badge>}
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
        <CardHeader>
          <CardTitle>Sample Holders</CardTitle>
          <p className="text-sm text-muted-foreground">Track which users currently have sample cases checked out.</p>
        </CardHeader>
        <CardContent>
          <SampleHoldersPanel
            holders={sampleHolders.map(h => ({ ...h, userId: h.userId! }))}
            products={items.map(i => ({
              id: i.productId ?? i.id,
              name: i.name,
              sku: i.sku,
              quantitySample: i.quantitySample ?? 0,
            }))}
            staffUsers={staffUsers}
          />
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
              <p className="text-sm text-muted-foreground">
                {inventoryHistoryUnavailable
                  ? 'Inventory history will appear after the latest database migration is applied.'
                  : 'No inventory activity recorded yet.'}
              </p>
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
