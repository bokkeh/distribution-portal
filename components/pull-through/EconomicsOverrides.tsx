'use client'

import { useState, useTransition } from 'react'
import { Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { setAccountHealthOverride, setOrderTastingAttribution } from '@/actions/tasting-economics'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { HEALTH_META } from '@/lib/pull-through/display'
import type { AccountHealthKind, OrderAttributionKind } from '@/lib/pull-through/types'

const HEALTH_ORDER: AccountHealthKind[] = ['growth', 'healthy', 'developing', 'tasting_dependent', 'stalled', 'unprofitable']

/** Admin override for an order's organic / tasting-assisted classification. */
export function OrderAttributionOverride({
  orderId,
  current,
  source,
}: {
  orderId: string
  current: OrderAttributionKind | null
  source: 'auto' | 'override' | null
}) {
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<OrderAttributionKind | ''>(current ?? '')
  const [reason, setReason] = useState('')
  const [isPending, startTransition] = useTransition()

  const submit = (nextKind: OrderAttributionKind | null) =>
    startTransition(async () => {
      const result = await setOrderTastingAttribution({ orderId, kind: nextKind, reason: nextKind ? reason : null })
      if ('error' in result && result.error) {
        toast.error('Not saved', { description: result.error })
        return
      }
      toast.success(nextKind ? 'Order classification updated' : 'Back to automatic classification')
      setOpen(false)
      setReason('')
    })

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:underline" title="Override classification">
        <Pencil className="h-3 w-3" />
        {source === 'override' ? 'Change' : 'Override'}
      </button>
    )
  }

  return (
    <div className="mt-1 space-y-1.5 rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
      <select
        value={kind}
        onChange={(event) => setKind(event.target.value as OrderAttributionKind | '')}
        className="h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-xs"
      >
        <option value="">Choose…</option>
        <option value="organic">Organic</option>
        <option value="assisted">Tasting-assisted</option>
      </select>
      <Input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Reason (required)" className="h-8 text-xs" />
      <div className="flex flex-wrap gap-1">
        <Button type="button" size="sm" className="h-7 text-xs" disabled={isPending || !kind || !reason.trim()} onClick={() => kind && submit(kind)}>
          Save
        </Button>
        {source === 'override' && (
          <Button type="button" size="sm" variant="outline" className="h-7 text-xs" disabled={isPending} onClick={() => submit(null)}>
            Use automatic
          </Button>
        )}
        <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  )
}

/** Admin override for the account health classification, with a required reason. */
export function AccountHealthOverride({
  accountId,
  current,
  source,
  autoKind,
}: {
  accountId: string
  current: AccountHealthKind
  source: 'auto' | 'override'
  autoKind: AccountHealthKind
}) {
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<AccountHealthKind>(current)
  const [reason, setReason] = useState('')
  const [isPending, startTransition] = useTransition()

  const submit = (nextKind: AccountHealthKind | null) =>
    startTransition(async () => {
      const result = await setAccountHealthOverride({ accountId, kind: nextKind, reason: nextKind ? reason : null })
      if ('error' in result && result.error) {
        toast.error('Not saved', { description: result.error })
        return
      }
      toast.success(nextKind ? 'Account health updated' : 'Back to automatic classification')
      setOpen(false)
      setReason('')
    })

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => setOpen(true)}>
        <Pencil className="mr-1 h-3 w-3" />
        {source === 'override' ? 'Change classification' : 'Override classification'}
      </Button>
    )
  }

  return (
    <div className="mt-2 w-full space-y-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <p className="text-xs text-slate-600">
        Automatic rule says <span className="font-semibold">{HEALTH_META[autoKind].label}</span>. Overrides are shown as
        &quot;set manually&quot; with your reason.
      </p>
      <select value={kind} onChange={(event) => setKind(event.target.value as AccountHealthKind)} className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm">
        {HEALTH_ORDER.map((value) => (
          <option key={value} value={value}>
            {HEALTH_META[value].label} — {HEALTH_META[value].description}
          </option>
        ))}
      </select>
      <Input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Reason for the override (required)" className="h-9" />
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={isPending || !reason.trim()} onClick={() => submit(kind)}>
          Save
        </Button>
        {source === 'override' && (
          <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={() => submit(null)}>
            Use automatic
          </Button>
        )}
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
