'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { bulkUpdateOrderStatus } from '@/actions/orders'

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
  const [selected, setSelected] = useState<string[]>([])
  const [status, setStatus] = useState<'pending' | 'confirmed' | 'fulfilled' | 'cancelled'>('confirmed')
  const [isPending, startTransition] = useTransition()

  const allSelected = useMemo(() => orders.length > 0 && selected.length === orders.length, [orders.length, selected.length])

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
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">Bulk Order Actions</p>
          <p className="text-xs text-slate-500">Update multiple orders at once for the {mode} queue.</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={toggleAll}>
          {allSelected ? 'Clear all' : 'Select all'}
        </Button>
      </div>
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {orders.map((order) => (
          <label key={order.id} className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700">
            <input type="checkbox" checked={selected.includes(order.id)} onChange={() => toggleOrder(order.id)} />
            <span>{order.label}</span>
          </label>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <select
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          value={status}
          onChange={(event) => setStatus(event.target.value as typeof status)}
        >
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="fulfilled">Fulfilled</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <Button type="button" disabled={!selected.length || isPending} onClick={submit}>
          Apply to {selected.length || 0} order{selected.length === 1 ? '' : 's'}
        </Button>
      </div>
    </div>
  )
}
