'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { PlayCircle, X } from 'lucide-react'
import { duplicateSalesRoute } from '@/actions/sales-routes'

export default function RerunRouteButton({
  routeId,
  defaultName,
}: {
  routeId: string
  defaultName: string
}) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      await duplicateSalesRoute(routeId, formData)
    })
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-1.5"
      >
        <PlayCircle className="w-3.5 h-3.5" />
        Re-run
      </Button>
    )
  }

  return (
    <form action={handleSubmit} className="flex items-center gap-2">
      <input
        name="name"
        required
        autoFocus
        defaultValue={`${defaultName} (copy)`}
        placeholder="Name for this run"
        className="h-8 w-48 rounded-md border border-input bg-transparent px-2.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />
      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? 'Creating...' : 'Create'}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => setOpen(false)}
        disabled={isPending}
      >
        <X className="w-4 h-4" />
      </Button>
    </form>
  )
}
