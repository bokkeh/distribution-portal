'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createPromotionCatalogOrder } from '@/actions/promotion-catalog'
import { Button } from '@/components/ui/button'

export function PromotionCatalogRequestForm({ itemId }: { itemId: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await createPromotionCatalogOrder(formData)
      if (result?.error) {
        toast.error('Request not submitted', { description: result.error })
        return
      }
      toast.success('Promotion request submitted')
      router.refresh()
    })
  }

  return (
    <form action={handleSubmit} className="space-y-3">
      <input type="hidden" name="itemId" value={itemId} />
      <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
        <input
          name="quantity"
          type="number"
          min="1"
          defaultValue="1"
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        <textarea
          name="customerNotes"
          rows={2}
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          placeholder="Optional notes for your rep or operations team."
        />
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? 'Submitting...' : 'Request This Item'}
      </Button>
    </form>
  )
}
