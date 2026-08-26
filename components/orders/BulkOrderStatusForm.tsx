'use client'

import { useId, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckSquare2, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { bulkUpdateOrderStatus } from '@/actions/orders'
import { cn } from '@/lib/utils'

type OrderOption = {
  id: string
  label: string
}

export function BulkOrderStatusForm({
  orders,
  mode,
}: {
  orders: OrderOption[]
  mode: 'admin' | 'staff'
}) {
  const router = useRouter()
  const panelId = useId()
  const [expanded, setExpanded] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [status, setStatus] = useState<'pending' | 'confirmed' | 'fulfilled' | 'cancelled'>('confirmed')
  const [isPending, startTransition] = useTransition()

  const allSelected = useMemo(() => orders.length > 0 && selected.length === orders.length, [orders.length, selected.length])
  const selectedSet = useMemo(() => new Set(selected), [selected])

  function toggleOrder(id: string) {
    setSelected((prev) => prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id])
  }

  function toggleAll() {
    setSelected(allSelected ? [] : orders.map((order) => order.id))
  }

  function submit() {
    startTransition(async () => {
      await bulkUpdateOrderStatus({
        orderIds: selected,
        status,
      })
      setSelected([])
      router.refresh()
    })
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => setExpanded((value) => !value)}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-600">
          <CheckSquare2 className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-slate-900">Bulk order actions</span>
          <span className="block truncate text-xs text-slate-500">
            {selected.length > 0
              ? `${selected.length} order${selected.length === 1 ? '' : 's'} selected`
              : `Select orders to update the ${mode} queue`}
          </span>
        </span>
        {selected.length > 0 ? (
          <span className="ui-operational-data rounded-md bg-blue-50 px-2 py-1 text-[11px] text-blue-700">
            {selected.length} selected
          </span>
        ) : null}
        <ChevronDown
          className={cn('h-4 w-4 shrink-0 text-slate-400 transition-transform', expanded && 'rotate-180')}
          aria-hidden="true"
        />
      </button>

      {expanded ? (
        <div id={panelId} className="border-t border-slate-200">
          <div className="flex items-center justify-between gap-3 bg-slate-50 px-3 py-2">
            <p className="text-xs text-slate-500">Choose one or more orders, then apply a status.</p>
            <Button type="button" variant="ghost" size="sm" onClick={toggleAll} disabled={orders.length === 0}>
              {allSelected ? 'Clear all' : 'Select all'}
            </Button>
          </div>

          <div className="grid max-h-64 gap-1.5 overflow-y-auto p-2 sm:grid-cols-2 xl:grid-cols-3">
            {orders.map((order) => (
              <label
                key={order.id}
                className={cn(
                  'flex min-w-0 cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs transition-colors',
                  selectedSet.has(order.id)
                    ? 'border-blue-300 bg-blue-50 text-blue-800'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                )}
              >
                <input
                  type="checkbox"
                  checked={selectedSet.has(order.id)}
                  onChange={() => toggleOrder(order.id)}
                  className="h-3.5 w-3.5 shrink-0 accent-[#ff5a00]"
                />
                <span className="truncate" title={order.label}>{order.label}</span>
              </label>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 bg-white px-3 py-2.5">
            <select
              aria-label="New order status"
              className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm"
              value={status}
              onChange={(event) => setStatus(event.target.value as typeof status)}
            >
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="fulfilled">Fulfilled</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <Button type="button" size="sm" disabled={!selected.length || isPending} onClick={submit}>
              {isPending ? 'Applying…' : `Apply to ${selected.length} order${selected.length === 1 ? '' : 's'}`}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
