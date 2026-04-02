'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Save, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { removeAccountInventoryItem, upsertAccountInventoryItem } from '@/actions/crm-account'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { AccountInventoryItem } from '@/lib/crm/account-detail-data'
import { formatDate } from '@/lib/utils'

type ProductOption = {
  id: string
  name: string
  sku: string
  unit: string
  active: boolean
}

export function AccountInventoryOnHandCard({
  accountId,
  items,
  products,
}: {
  accountId: string
  items: AccountInventoryItem[]
  products: ProductOption[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [draftCounts, setDraftCounts] = useState<Record<string, { casesOnHand: string; bottlesOnHand: string }>>(
    Object.fromEntries(items.map((item) => [item.id, { casesOnHand: item.casesOnHand, bottlesOnHand: item.bottlesOnHand }]))
  )
  const [selectedProductId, setSelectedProductId] = useState('')
  const [newCases, setNewCases] = useState('0')
  const [newBottles, setNewBottles] = useState('0')

  const existingProductIds = new Set(items.map((item) => item.productId))
  const addableProducts = useMemo(
    () => products.filter((product) => !existingProductIds.has(product.id)),
    [products, items]
  )
  const totalCases = items.reduce((sum, item) => sum + Number(item.casesOnHand || 0), 0)
  const totalBottles = items.reduce((sum, item) => sum + Number(item.bottlesOnHand || 0), 0)

  function refreshWithToast(message: string) {
    toast.success(message)
    router.refresh()
  }

  function saveProduct(productId: string, casesOnHand: string, bottlesOnHand: string) {
    const formData = new FormData()
    formData.append('accountId', accountId)
    formData.append('productId', productId)
    formData.append('casesOnHand', casesOnHand)
    formData.append('bottlesOnHand', bottlesOnHand)

    startTransition(async () => {
      const result = await upsertAccountInventoryItem(formData)
      if (result?.error) {
        toast.error(result.error)
        return
      }
      refreshWithToast('Inventory updated')
    })
  }

  function addProduct() {
    if (!selectedProductId) {
      toast.error('Choose a product to add')
      return
    }

    saveProduct(selectedProductId, newCases, newBottles)
    setSelectedProductId('')
    setNewCases('0')
    setNewBottles('0')
  }

  function removeItem(itemId: string) {
    if (!confirm('Remove this inventory item?')) return

    startTransition(async () => {
      const result = await removeAccountInventoryItem(itemId)
      if (result?.error) {
        toast.error(result.error)
        return
      }
      refreshWithToast('Inventory item removed')
    })
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <CardTitle>Total Inventory On Hand</CardTitle>
          <p className="mt-1 text-sm text-slate-500">Update account-held inventory directly from the CRM record.</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-right">
          <p className="text-xs uppercase tracking-wide text-slate-500">Tracked inventory</p>
          <p className="mt-1 text-lg font-bold text-slate-900">{totalCases.toFixed(2)} cases</p>
          <p className="text-sm font-medium text-slate-600">{totalBottles.toFixed(2)} bottles</p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="pb-2 pr-3 font-medium">Product</th>
                <th className="pb-2 pr-3 font-medium">SKU</th>
                <th className="pb-2 pr-3 font-medium">Unit</th>
                <th className="pb-2 pr-3 font-medium">Cases on hand</th>
                <th className="pb-2 pr-3 font-medium">Bottles on hand</th>
                <th className="pb-2 pr-3 font-medium">Last updated</th>
                <th className="pb-2 pr-3 font-medium">By</th>
                <th className="pb-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-4 text-sm text-slate-500">No account inventory tracked yet.</td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="border-b last:border-0">
                    <td className="py-3 pr-3">
                      <p className="font-medium text-slate-900">{item.productName}</p>
                    </td>
                    <td className="py-3 pr-3 text-slate-600">{item.sku}</td>
                    <td className="py-3 pr-3 text-slate-600">{item.unitType ?? 'unit'}</td>
                    <td className="py-3 pr-3">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={draftCounts[item.id]?.casesOnHand ?? item.casesOnHand}
                        onChange={(event) => setDraftCounts((current) => ({
                          ...current,
                          [item.id]: {
                            casesOnHand: event.target.value,
                            bottlesOnHand: current[item.id]?.bottlesOnHand ?? item.bottlesOnHand,
                          },
                        }))}
                        className="h-9 w-28 rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm"
                      />
                    </td>
                    <td className="py-3 pr-3">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={draftCounts[item.id]?.bottlesOnHand ?? item.bottlesOnHand}
                        onChange={(event) => setDraftCounts((current) => ({
                          ...current,
                          [item.id]: {
                            casesOnHand: current[item.id]?.casesOnHand ?? item.casesOnHand,
                            bottlesOnHand: event.target.value,
                          },
                        }))}
                        className="h-9 w-28 rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm"
                      />
                    </td>
                    <td className="py-3 pr-3 text-xs text-slate-500" suppressHydrationWarning>{formatDate(item.updatedAt)}</td>
                    <td className="py-3 pr-3 text-xs text-slate-500">{item.updatedByName ?? 'System'}{item.updatedByRole ? ` (${item.updatedByRole})` : ''}</td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={isPending}
                          onClick={() => saveProduct(
                            item.productId,
                            draftCounts[item.id]?.casesOnHand ?? item.casesOnHand,
                            draftCounts[item.id]?.bottlesOnHand ?? item.bottlesOnHand,
                          )}
                        >
                          <Save className="mr-1.5 h-3.5 w-3.5" />Save
                        </Button>
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="rounded p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                          title="Remove inventory item"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
          <div className="grid gap-3 md:grid-cols-[1fr_140px_140px_auto]">
            <select
              value={selectedProductId}
              onChange={(event) => setSelectedProductId(event.target.value)}
              className="flex h-10 rounded-md border border-input bg-white px-3 py-2 text-sm shadow-sm"
            >
              <option value="">Add product to account inventory</option>
              {addableProducts.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} ({product.sku}){product.active ? '' : ' - inactive'}
                </option>
              ))}
            </select>
            <input
              type="number"
              min="0"
              step="0.01"
              value={newCases}
              onChange={(event) => setNewCases(event.target.value)}
              className="h-10 rounded-md border border-input bg-white px-3 py-2 text-sm shadow-sm"
              placeholder="Cases"
            />
            <input
              type="number"
              min="0"
              step="0.01"
              value={newBottles}
              onChange={(event) => setNewBottles(event.target.value)}
              className="h-10 rounded-md border border-input bg-white px-3 py-2 text-sm shadow-sm"
              placeholder="Bottles"
            />
            <Button type="button" disabled={isPending || !selectedProductId} onClick={addProduct}>
              <Plus className="mr-2 h-4 w-4" />Add Product
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
