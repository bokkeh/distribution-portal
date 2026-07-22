'use client'

import { useTransition } from 'react'
import { RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { undoSampleDisposition } from '@/actions/inventory-allocations'
import { Button } from '@/components/ui/button'

export function UndoInventoryTransactionButton({ transactionId }: { transactionId: string }) {
  const [isPending, startTransition] = useTransition()

  function undo() {
    if (!window.confirm('Undo this disposition and restore the samples to the previous holder?')) return
    const formData = new FormData()
    formData.set('transactionId', transactionId)
    startTransition(async () => {
      const result = await undoSampleDisposition(formData)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      toast.success('Sample disposition undone')
    })
  }

  return (
    <Button type="button" size="sm" variant="outline" onClick={undo} disabled={isPending}>
      <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
      {isPending ? 'Undoing…' : 'Undo'}
    </Button>
  )
}
