'use client'

import { useState } from 'react'
import { updateTastingStatus } from '@/actions/tastings'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CANCELLATION_REASON_OPTIONS } from '@/lib/tastings/cancellation'

export function CancelTastingControl({
  tastingId,
  mode,
  redirectTo,
  triggerLabel = 'Cancelled',
  triggerClassName,
}: {
  tastingId: string
  mode: string
  redirectTo?: string
  triggerLabel?: string
  triggerClassName?: string
}) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" className={triggerClassName} onClick={() => setOpen(true)}>
        {triggerLabel}
      </Button>
    )
  }

  return (
    <form action={updateTastingStatus} className="flex flex-col gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
      <input type="hidden" name="tastingId" value={tastingId} />
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="status" value="cancelled" />
      {redirectTo ? <input type="hidden" name="redirectTo" value={redirectTo} /> : null}
      <div className="space-y-1">
        <Label className="text-xs">Cancellation Reason</Label>
        <select
          name="cancellationReason"
          required
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          className="flex h-9 w-full rounded-md border border-input bg-white px-3 text-sm shadow-sm"
        >
          <option value="">Select a reason...</option>
          {CANCELLATION_REASON_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>
      {reason === 'other' ? (
        <div className="space-y-1">
          <Label className="text-xs">Explain</Label>
          <Input name="cancellationNote" required placeholder="Short explanation" className="h-9" />
        </div>
      ) : null}
      <div className="flex gap-2">
        <Button type="submit" variant="destructive" size="sm" className="flex-1">Confirm Cancellation</Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>Back</Button>
      </div>
    </form>
  )
}
