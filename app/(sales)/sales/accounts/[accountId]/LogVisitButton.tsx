'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { logVisit } from '@/actions/sales-members'
import { Button } from '@/components/ui/button'
import { CheckCircle2, Loader2 } from 'lucide-react'

export function LogVisitButton({ customerId, salesMemberId }: { customerId: string; salesMemberId: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [done, setDone] = useState(false)

  function handleLogVisit() {
    startTransition(async () => {
      await logVisit(customerId, salesMemberId)
      setDone(true)
      router.refresh()
    })
  }

  if (done) {
    return (
      <div className="flex items-center gap-1.5 text-sm text-green-700">
        <CheckCircle2 className="w-4 h-4" />
        Visit logged!
      </div>
    )
  }

  return (
    <Button size="sm" className="w-full" onClick={handleLogVisit} disabled={isPending}>
      {isPending ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-2" />}
      Log Visit Today
    </Button>
  )
}
