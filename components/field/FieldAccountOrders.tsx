'use client'

import { useEffect, useState } from 'react'
import { getFieldAccountOrders } from '@/actions/field-data'
import { formatEasternDate } from '@/lib/tastings/time'
import { formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/button'

type History = Awaited<ReturnType<typeof getFieldAccountOrders>>

export function FieldAccountOrders({ accountId }: { accountId: string }) {
  const [history, setHistory] = useState<History | null>(null)
  const [loading, setLoading] = useState(true), [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0), [showCount, setShowCount] = useState(3)
  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true); setError('')
      try { const result = await getFieldAccountOrders(accountId); if (active) setHistory(result) }
      catch { if (active) setError('Could not load order history. Check your connection and retry.') }
      finally { if (active) setLoading(false) }
    }
    void load()
    return () => { active = false }
  }, [accountId, refresh])
  return <section aria-label="Order history" className="space-y-4 rounded-2xl border bg-white p-4">
    <div className="flex items-center justify-between gap-2"><h2 className="text-lg font-semibold">Order history</h2>{error ? <Button type="button" variant="outline" className="h-11" disabled={loading} onClick={() => setRefresh(value => value + 1)}>Retry</Button> : null}</div>
    {loading && !history ? <p role="status" className="text-sm">Loading orders…</p> : null}
    {error ? <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{error}</p> : null}
    {history ? <>
      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-3 rounded-xl bg-[#120f0e] p-4 text-white sm:col-span-1"><p className="text-xs uppercase tracking-wide text-stone-300">Total revenue</p><p className="mt-1 text-2xl font-bold">{formatCurrency(history.totalRevenue)}</p></div>
        <div className="col-span-1 rounded-xl bg-stone-50 p-4 sm:col-span-1"><p className="text-xs uppercase tracking-wide text-muted-foreground">Orders</p><p className="mt-1 text-2xl font-bold">{history.orderCount}</p></div>
        <div className="col-span-2 rounded-xl bg-stone-50 p-4 sm:col-span-1"><p className="text-xs uppercase tracking-wide text-muted-foreground">Last order</p><p className="mt-1 text-lg font-bold">{history.lastOrderDate ? formatEasternDate(history.lastOrderDate) : '—'}</p></div>
      </div>
      {history.orders.length ? <div className="space-y-2">{history.orders.slice(0, showCount).map(order => <div key={order.id} className="rounded-xl border bg-stone-50 p-3">
        <p className="flex items-baseline justify-between gap-2 font-semibold"><span>{formatEasternDate(order.date)}</span><span>{order.total != null ? formatCurrency(order.total) : '—'}</span></p>
        <p className="mt-1 text-xs font-medium text-muted-foreground">{order.label}</p>
        {order.summary ? <p className="mt-1 break-words text-sm text-muted-foreground">{order.summary}</p> : null}
      </div>)}</div> : <p className="text-sm text-muted-foreground">No orders recorded for this account yet.</p>}
      {history.orders.length > showCount ? <Button type="button" variant="outline" className="h-12 w-full" onClick={() => setShowCount(count => count + 10)}>Show more orders ({history.orders.length - showCount} remaining)</Button> : null}
      <p className="text-xs text-muted-foreground">Revenue includes historical orders and excludes cancelled and sample orders.</p>
    </> : null}
  </section>
}
