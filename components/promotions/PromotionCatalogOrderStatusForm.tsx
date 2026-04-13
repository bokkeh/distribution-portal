'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { updatePromotionCatalogOrder } from '@/actions/promotion-catalog'
import { Button } from '@/components/ui/button'

export function PromotionCatalogOrderStatusForm({
  orderId,
  currentStatus,
}: {
  orderId: string
  currentStatus: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await updatePromotionCatalogOrder(formData)
      if (result?.error) {
        toast.error('Status not updated', { description: result.error })
        return
      }
      toast.success('Promotion request updated')
      router.refresh()
    })
  }

  return (
    <form action={handleSubmit} className="space-y-2">
      <input type="hidden" name="orderId" value={orderId} />
      <select
        name="status"
        defaultValue={currentStatus}
        className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <option value="requested">Requested</option>
        <option value="approved">Approved</option>
        <option value="in_production">In Production</option>
        <option value="ready_for_delivery">Ready for Delivery</option>
        <option value="delivered">Delivered</option>
        <option value="completed">Completed</option>
        <option value="cancelled">Cancelled</option>
      </select>
      <textarea
        name="internalNotes"
        rows={2}
        className="w-full rounded-md border border-input bg-transparent px-2 py-1.5 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        placeholder="Optional internal note"
      />
      <Button type="submit" variant="outline" size="sm" disabled={pending} className="w-full">
        {pending ? 'Saving...' : 'Update Status'}
      </Button>
    </form>
  )
}
