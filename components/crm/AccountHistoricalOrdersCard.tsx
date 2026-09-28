'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { History, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { addHistoricalOrder, deleteHistoricalOrder } from '@/actions/historical-orders'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency, formatDate } from '@/lib/utils'

export type HistoricalOrderRow = {
  id: string
  orderDate: Date
  productName: string | null
  cases: string
  bottles: string
  orderValue: string | null
  notes: string | null
  source: string
}

type ProductOption = { id: string; name: string; sku: string }

const SOURCE_LABELS: Record<string, string> = {
  imported: 'Imported',
  manual_historical: 'Manual Historical Entry',
  legacy_system: 'Legacy System',
}

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10)
}

export function AccountHistoricalOrdersCard({
  accountId,
  historicalOrders,
  products,
  canManage,
}: {
  accountId: string
  historicalOrders: HistoricalOrderRow[]
  products: ProductOption[]
  canManage: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [productId, setProductId] = useState('')
  const [productNameFreeform, setProductNameFreeform] = useState('')
  const [orderDate, setOrderDate] = useState(toDateInputValue(new Date()))
  const [cases, setCases] = useState('0')
  const [bottles, setBottles] = useState('0')
  const [orderValue, setOrderValue] = useState('')
  const [notes, setNotes] = useState('')
  const [source, setSource] = useState<'imported' | 'manual_historical' | 'legacy_system'>('manual_historical')

  function submit() {
    if (!productId && !productNameFreeform.trim()) {
      toast.error('Select a product or enter a product name')
      return
    }

    const formData = new FormData()
    formData.append('accountId', accountId)
    formData.append('orderDate', orderDate)
    if (productId) formData.append('productId', productId)
    if (productNameFreeform.trim()) formData.append('productNameFreeform', productNameFreeform.trim())
    formData.append('cases', cases)
    formData.append('bottles', bottles)
    if (orderValue) formData.append('orderValue', orderValue)
    if (notes) formData.append('notes', notes)
    formData.append('source', source)

    startTransition(async () => {
      const result = await addHistoricalOrder(formData)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Historical order added')
      setProductId('')
      setProductNameFreeform('')
      setCases('0')
      setBottles('0')
      setOrderValue('')
      setNotes('')
      router.refresh()
    })
  }

  function remove(id: string) {
    if (!window.confirm('Delete this historical order?')) return
    startTransition(async () => {
      const result = await deleteHistoricalOrder(id, accountId)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Historical order removed')
      router.refresh()
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><History className="h-4 w-4" />Historical Orders</CardTitle>
        <p className="mt-1 text-sm text-slate-500">
          Pre-system order history for lifetime reporting. These never trigger shipment, inventory, or payment workflows.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {canManage ? (
          <div className="grid gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 lg:grid-cols-[140px_minmax(160px,1fr)_90px_90px_110px_minmax(140px,1fr)_120px_auto] lg:items-end">
            <label className="space-y-1 text-xs font-medium text-slate-600">
              Order Date
              <input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} className="h-9 w-full rounded-md border border-input bg-white px-2 py-1 text-sm shadow-sm" />
            </label>
            <label className="space-y-1 text-xs font-medium text-slate-600">
              Product
              <select value={productId} onChange={(e) => setProductId(e.target.value)} className="h-9 w-full rounded-md border border-input bg-white px-2 py-1 text-sm shadow-sm">
                <option value="">Custom / legacy product...</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>{product.name} ({product.sku})</option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs font-medium text-slate-600">
              Cases
              <input type="number" min="0" step="0.01" value={cases} onChange={(e) => setCases(e.target.value)} className="h-9 w-full rounded-md border border-input bg-white px-2 py-1 text-sm shadow-sm" />
            </label>
            <label className="space-y-1 text-xs font-medium text-slate-600">
              Bottles
              <input type="number" min="0" step="0.01" value={bottles} onChange={(e) => setBottles(e.target.value)} className="h-9 w-full rounded-md border border-input bg-white px-2 py-1 text-sm shadow-sm" />
            </label>
            <label className="space-y-1 text-xs font-medium text-slate-600">
              Order Value ($)
              <input type="number" min="0" step="0.01" value={orderValue} onChange={(e) => setOrderValue(e.target.value)} className="h-9 w-full rounded-md border border-input bg-white px-2 py-1 text-sm shadow-sm" placeholder="Optional" />
            </label>
            <label className="space-y-1 text-xs font-medium text-slate-600">
              Notes
              <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} className="h-9 w-full rounded-md border border-input bg-white px-2 py-1 text-sm shadow-sm" placeholder="Optional" />
            </label>
            <label className="space-y-1 text-xs font-medium text-slate-600">
              Source
              <select value={source} onChange={(e) => setSource(e.target.value as typeof source)} className="h-9 w-full rounded-md border border-input bg-white px-2 py-1 text-sm shadow-sm">
                <option value="manual_historical">Manual Historical Entry</option>
                <option value="imported">Imported</option>
                <option value="legacy_system">Legacy System</option>
              </select>
            </label>
            {!productId && (
              <label className="space-y-1 text-xs font-medium text-slate-600 lg:col-span-3">
                Custom product name (used only when no product is selected)
                <input type="text" value={productNameFreeform} onChange={(e) => setProductNameFreeform(e.target.value)} className="h-9 w-full rounded-md border border-input bg-white px-2 py-1 text-sm shadow-sm" placeholder="e.g. Wisher Vodka (legacy SKU)" />
              </label>
            )}
            <Button type="button" disabled={isPending} onClick={submit}>
              <Plus className="mr-2 h-4 w-4" />Add Historical Order
            </Button>
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="pb-2 pr-3 font-medium">Date</th>
                <th className="pb-2 pr-3 font-medium">Product</th>
                <th className="pb-2 pr-3 font-medium">Cases / Bottles</th>
                <th className="pb-2 pr-3 font-medium">Value</th>
                <th className="pb-2 pr-3 font-medium">Source</th>
                <th className="pb-2 pr-3 font-medium">Notes</th>
                {canManage ? <th className="pb-2 font-medium">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {historicalOrders.length === 0 ? (
                <tr><td colSpan={7} className="py-4 text-sm text-slate-500">No historical orders on file.</td></tr>
              ) : (
                historicalOrders.map((row) => (
                  <tr key={row.id} className="border-b last:border-0">
                    <td className="py-3 pr-3 text-slate-700" suppressHydrationWarning>{formatDate(row.orderDate)}</td>
                    <td className="py-3 pr-3 font-medium text-slate-900">{row.productName ?? 'Unknown'}</td>
                    <td className="py-3 pr-3 text-slate-600">{row.cases} cases / {row.bottles} bottles</td>
                    <td className="py-3 pr-3 text-slate-600">{row.orderValue ? formatCurrency(row.orderValue) : '-'}</td>
                    <td className="py-3 pr-3"><Badge variant="outline" className="text-xs">{SOURCE_LABELS[row.source] ?? row.source}</Badge></td>
                    <td className="py-3 pr-3 text-xs text-slate-500">{row.notes ?? '-'}</td>
                    {canManage ? (
                      <td className="py-3">
                        <button type="button" onClick={() => remove(row.id)} className="rounded p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600" title="Delete">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
