'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { checkInRouteStop } from '@/actions/sales-members'
import { Button } from '@/components/ui/button'
import { MapPin, Loader2 } from 'lucide-react'

export function RouteStopCheckIn({ stopId }: { stopId: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleCheckIn() {
    startTransition(async () => {
      await checkInRouteStop(stopId)
      router.refresh()
    })
  }

  return (
    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleCheckIn} disabled={isPending}>
      {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <MapPin className="w-3 h-3 mr-1" />}
      Check In
    </Button>
  )
}
