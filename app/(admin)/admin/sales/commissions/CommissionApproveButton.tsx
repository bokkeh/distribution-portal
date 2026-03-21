'use client'

import { useTransition } from 'react'
import { approveCommission } from '@/actions/sales-members'
import { Button } from '@/components/ui/button'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Props {
  commissionId: string
  approvedByUserId: string
}

export function CommissionApproveButton({ commissionId, approvedByUserId }: Props) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleApprove() {
    startTransition(async () => {
      await approveCommission(commissionId, approvedByUserId)
      router.refresh()
    })
  }

  return (
    <Button size="sm" onClick={handleApprove} disabled={isPending} variant="outline" className="text-green-700 border-green-300 hover:bg-green-50">
      {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1" />}
      Approve
    </Button>
  )
}
