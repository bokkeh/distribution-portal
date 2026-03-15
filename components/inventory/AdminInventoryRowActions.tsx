'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { adjustStock, deleteSku } from '@/actions/inventory'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Link from 'next/link'

export function AdminInventoryRowActions({
  productId,
  editHref,
  quantityPaid,
  quantitySample,
  looseBottlePaid,
  reorderLevel,
}: {
  productId: string
  editHref?: string
  quantityPaid: number
  quantitySample: number
  looseBottlePaid: number
  reorderLevel: number
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [paid, setPaid] = useState(String(quantityPaid))
  const [sample, setSample] = useState(String(quantitySample))
  const isLowStock = Number(paid || 0) <= reorderLevel

  function handleSave() {
    startTransition(async () => {
      const formData = new FormData()
      formData.append('productId', productId)
      formData.append('quantityPaid', paid)
      formData.append('quantitySample', sample)
      formData.append('reorderLevel', String(reorderLevel))
      formData.append('looseBottlePaid', String(looseBottlePaid))
      const result = await adjustStock(formData)
      if (result?.error) {
        toast.error('Inventory update failed', { description: result.error })
        return
      }
      toast.success('Inventory updated')
      router.refresh()
    })
  }

  function handleDelete() {
    if (!window.confirm('Delete this SKU? If it has order history it will be retired instead of deleted.')) return

    startTransition(async () => {
      const formData = new FormData()
      formData.append('productId', productId)
      const result = await deleteSku(formData)
      if (result?.error) {
        toast.error('Delete failed', { description: result.error })
        return
      }
      toast.success(result?.retired ? 'SKU retired' : 'SKU deleted')
      router.refresh()
    })
  }

  return (
    <>
      <td className="px-6 py-4">
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min="0"
            value={paid}
            onChange={event => setPaid(event.target.value)}
            className={`h-8 w-20 ${isLowStock ? 'border-red-300 text-red-600' : ''}`}
          />
          {isLowStock && (
            <div className="flex items-center gap-1 text-orange-600" title="Low stock: paid cases are at or below the reorder level.">
              <AlertTriangle className="w-4 h-4 text-orange-500" />
              <span className="text-xs font-medium whitespace-nowrap">Low stock</span>
            </div>
          )}
        </div>
      </td>
      <td className="px-6 py-4">
        <Input
          type="number"
          min="0"
          value={sample}
          onChange={event => setSample(event.target.value)}
          className="h-8 w-20"
        />
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center justify-end gap-2">
          <Link href={editHref ?? `/admin/inventory/${productId}`}>
            <Button type="button" variant="ghost" size="sm">
              Edit
            </Button>
          </Link>
          <Button type="button" variant="outline" size="sm" onClick={handleSave} disabled={isPending}>
            {isPending ? 'Saving...' : 'Save'}
          </Button>
          <Button type="button" variant="ghost" size="sm" className="text-red-600 hover:bg-red-50 hover:text-red-700" onClick={handleDelete} disabled={isPending}>
            <Trash2 className="w-4 h-4" />
            Delete
          </Button>
        </div>
      </td>
    </>
  )
}
