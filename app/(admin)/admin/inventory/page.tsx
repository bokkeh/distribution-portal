import { db } from '@/db'
import { geographicPricingRules, inventory, inventoryTransactions, inventorySampleHolders, products, users } from '@/db/schema'
import { asc, desc, eq, inArray, sql } from 'drizzle-orm'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils'
import { toDisplayAvatarUrl } from '@/lib/users/avatar'
import Image from 'next/image'
import Link from 'next/link'
import { Plus, AlertTriangle } from 'lucide-react'
import { AdminInventoryRowActions } from '@/components/inventory/AdminInventoryRowActions'
import { toBottles } from '@/lib/inventory/units'

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
      looseBottleQuantity: inventorySampleHolders.looseBottleQuantity,
      notes: inventorySampleHolders.notes,
      checkedOutAt: inventorySampleHolders.checkedOutAt,
      productName: products.name,
      userName: users.name,
      userAvatarUrl: users.avatarUrl,
    })
    .from(inventorySampleHolders)
    .innerJoin(products, eq(inventorySampleHolders.productId, products.id))
    .innerJoin(users, eq(inventorySampleHolders.userId, users.id))
    .orderBy(asc(products.name), asc(users.name))

  const maxRulePrices = await db
    .select({
      productId: geographicPricingRules.productId,
      maxCasePrice: sql<string>`max(${geographicPricingRules.casePrice})`,
    })
    .from(geographicPricingRules)
    .where(eq(geographicPricingRules.isActive, true))
    .groupBy(geographicPricingRules.productId)

  const maxRulePriceMap = new Map(maxRulePrices.map((row) => [row.productId, Number(row.maxCasePrice)]))

  const items = await db
    .select({
      id: products.id,
      productId: inventory.productId,
      quantityPaid: inventory.quantityPaid,
      quantitySample: inventory.quantitySample,
      looseBottlePaid: inventory.looseBottlePaid,
      looseBottleSample: inventory.looseBottleSample,
      reorderLevel: inventory.reorderLevel,
      sku: products.sku,
      name: products.name,
      category: products.category,
      brand: products.brand,
      price: products.price,
      samplePrice: products.samplePrice,
      bottlePrice: products.bottlePrice,
      bottlesPerCase: products.bottlesPerCase,
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
    deltaWarehouseBottles: number
    deltaSampleBottles: number
    warehouseBottlesAfter: number
    sampleBottlesAfter: number
    checkedOutBottlesAfter: number
    createdAt: Date
    productName: string
    sku: string
    actorName: string | null
    actorAvatarUrl: string | null
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
        deltaWarehouseBottles: inventoryTransactions.deltaWarehouseBottles,
        deltaSampleBottles: inventoryTransactions.deltaSampleBottles,
        warehouseBottlesAfter: inventoryTransactions.warehouseBottlesAfter,
        sampleBottlesAfter: inventoryTransactions.sampleBottlesAfter,
        checkedOutBottlesAfter: inventoryTransactions.checkedOutBottlesAfter,
        createdAt: inventoryTransactions.createdAt,
        productName: products.name,
        sku: products.sku,
        actorName: users.name,
        actorAvatarUrl: users.avatarUrl,
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

  const totalPotentialRevenue = items.reduce((sum, item) => {
    if (!item.active) return sum

    const maxCasePrice = Math.max(
      Number(item.price ?? 0),
      maxRulePriceMap.get(item.id) ?? 0,
    )
    const bottlesPerCase = item.bottlesPerCase ?? 12
    const derivedBottlePrice = bottlesPerCase > 0 ? maxCasePrice / bottlesPerCase : 0
    const explicitBottlePrice = Number(item.bottlePrice ?? 0)
    const maxBottlePrice = explicitBottlePrice > 0 ? Math.max(explicitBottlePrice, derivedBottlePrice) : derivedBottlePrice

    return sum
      + (Number(item.quantityPaid ?? 0) * maxCasePrice)
      + (Number(item.looseBottlePaid ?? 0) * maxBottlePrice)
  }, 0)

  const inventoryTotals = items.reduce((totals, item) => {
    const bottlesPerCase = item.bottlesPerCase ?? 12
    totals.warehouse += toBottles(item.quantityPaid ?? 0, item.looseBottlePaid ?? 0, bottlesPerCase)
    totals.samples += toBottles(item.quantitySample ?? 0, item.looseBottleSample ?? 0, bottlesPerCase)
    return totals
  }, { warehouse: 0, samples: 0 })
  const checkedOutTotal = sampleHolders.reduce((sum, holder) => {
    const product = items.find(item => (item.productId ?? item.id) === holder.productId)
    return sum + toBottles(holder.quantity, holder.looseBottleQuantity, product?.bottlesPerCase ?? 12)
  }, 0)

  return (
    <div className="p-4 sm:p-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Inventory</h1>
          <p className="mt-1 text-muted-foreground">Allocate warehouse and sample stock in cases or bottles.</p>
        </div>
        <Link href="/admin/inventory/new">
          <Button><Plus className="w-4 h-4 mr-2" />Add Product</Button>
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card><CardContent className="p-4"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Warehouse</p><p className="mt-1 text-2xl font-semibold">{inventoryTotals.warehouse.toLocaleString()} bottles</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Samples available</p><p className="mt-1 text-2xl font-semibold">{inventoryTotals.samples.toLocaleString()} bottles</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Samples checked out</p><p className="mt-1 text-2xl font-semibold">{checkedOutTotal.toLocaleString()} bottles</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Potential revenue</p><p className="mt-1 text-2xl font-semibold">{formatCurrency(totalPotentialRevenue)}</p></CardContent></Card>
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
                  <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Warehouse</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Samples Available</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Checked Out</th>
                  <th className="text-right px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Actions</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Price</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.length === 0 ? (
                  <tr><td colSpan={8} className="px-6 py-12 text-center text-muted-foreground">No products in inventory. Add your first product.</td></tr>
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
                        productName={item.name}
                        warehouseBottles={toBottles(item.quantityPaid ?? 0, item.looseBottlePaid ?? 0, item.bottlesPerCase ?? 12)}
                        sampleBottles={toBottles(item.quantitySample ?? 0, item.looseBottleSample ?? 0, item.bottlesPerCase ?? 12)}
                        bottlesPerCase={item.bottlesPerCase ?? 12}
                        holders={sampleHolders.filter(holder => holder.productId === (item.productId ?? item.id)).map(holder => ({
                          id: holder.id,
                          userId: holder.userId!,
                          userName: holder.userName,
                          bottles: toBottles(holder.quantity, holder.looseBottleQuantity, item.bottlesPerCase ?? 12),
                          notes: holder.notes,
                        }))}
                        staffUsers={staffUsers}
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
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-200 text-xs font-semibold text-slate-600" title={tx.actorName ?? 'System'}>
                    {toDisplayAvatarUrl(tx.actorAvatarUrl) ? (
                      <Image
                        src={toDisplayAvatarUrl(tx.actorAvatarUrl)!}
                        alt={`${tx.actorName ?? 'System'} profile picture`}
                        width={36}
                        height={36}
                        className="h-9 w-9 object-cover"
                        unoptimized
                      />
                    ) : (tx.actorName ?? 'System').split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900">{tx.productName} <span className="text-xs font-mono text-muted-foreground">{tx.sku}</span></p>
                  <p className="mt-1 text-xs text-muted-foreground">{tx.reason ?? tx.type}</p>
                  <p className="mt-1 text-xs text-muted-foreground">By {tx.actorName ?? 'System'} • {new Date(tx.createdAt).toLocaleString()}</p>
                  </div>
                </div>
                <div className="text-right text-xs">
                  {['inventory_transfer', 'sample_checkout', 'sample_return', 'sample_disposition'].includes(tx.type) ? <>
                    <p className={tx.deltaWarehouseBottles === 0 ? 'text-muted-foreground' : tx.deltaWarehouseBottles > 0 ? 'text-green-600' : 'text-red-600'}>Warehouse: {tx.deltaWarehouseBottles > 0 ? '+' : ''}{tx.deltaWarehouseBottles} bottles</p>
                    <p className={tx.deltaSampleBottles === 0 ? 'text-muted-foreground' : tx.deltaSampleBottles > 0 ? 'text-green-600' : 'text-red-600'}>Samples: {tx.deltaSampleBottles > 0 ? '+' : ''}{tx.deltaSampleBottles} bottles</p>
                    <p className="mt-1 text-muted-foreground">After: {tx.warehouseBottlesAfter} warehouse / {tx.sampleBottlesAfter} sample / {tx.checkedOutBottlesAfter} out</p>
                  </> : <>
                    <p className={tx.deltaPaid === 0 ? 'text-muted-foreground' : tx.deltaPaid > 0 ? 'text-green-600' : 'text-red-600'}>Warehouse cases: {tx.deltaPaid > 0 ? `+${tx.deltaPaid}` : tx.deltaPaid}</p>
                    <p className={tx.deltaSample === 0 ? 'text-muted-foreground' : tx.deltaSample > 0 ? 'text-green-600' : 'text-red-600'}>Sample cases: {tx.deltaSample > 0 ? `+${tx.deltaSample}` : tx.deltaSample}</p>
                    <p className={tx.deltaLooseBottlePaid === 0 ? 'text-muted-foreground' : tx.deltaLooseBottlePaid > 0 ? 'text-green-600' : 'text-red-600'}>Loose bottles: {tx.deltaLooseBottlePaid > 0 ? `+${tx.deltaLooseBottlePaid}` : tx.deltaLooseBottlePaid}</p>
                    <p className="mt-1 text-muted-foreground">After: {tx.quantityPaidAfter} warehouse / {tx.quantitySampleAfter} sample cases</p>
                  </>}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
