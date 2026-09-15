'use client'

import { useTransition } from 'react'
import { PackageCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { applyTastingReportInventory } from '@/actions/tastings'

/** Pushes the report's after-tasting shelf count onto the account's inventory ledger. */
export function ApplyReportInventoryButton({ tastingId }: { tastingId: string }) {
  const [isPending, startTransition] = useTransition()

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const result = await applyTastingReportInventory(tastingId)
          if ('error' in result && result.error) {
            toast.error('Inventory not updated', { description: result.error })
            return
          }
          toast.success('Account inventory updated', { description: 'message' in result ? result.message : undefined })
        })
      }
    >
      <PackageCheck className="mr-1.5 h-4 w-4" />
      {isPending ? 'Applying…' : 'Apply count to inventory'}
    </Button>
  )
}
