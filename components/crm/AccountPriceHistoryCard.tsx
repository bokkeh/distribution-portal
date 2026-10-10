'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { deleteAccountPrice, type getAccountPriceHistory, type getAccountPriceSales } from '@/actions/account-prices'
import { AccountObservationForm } from './AccountObservationForm'
import { formatEasternDateTime } from '@/lib/tastings/time'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type PriceEntry = Awaited<ReturnType<typeof getAccountPriceHistory>>[number]

export function AccountPriceHistoryCard({ accountId, entries, products, sales }: {
  accountId: string
  entries: PriceEntry[]
  products: { id: string; name: string; sku: string }[]
  sales: Awaited<ReturnType<typeof getAccountPriceSales>>
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [productId, setProductId] = useState('')
  const [now] = useState(() => Date.now())
  const inputClass = 'h-10 w-full rounded-md border border-input bg-white px-3 text-sm'
  const visible = productId ? entries.filter(entry => entry.productId === productId) : entries
  const latest = [...new Map([...entries].reverse().map(entry => [`${entry.productId}|${entry.productSize ?? entry.sku}|${entry.currency}`, entry])).values()]

  return <Card>
    <CardHeader>
      <CardTitle>Shelf Price History</CardTitle>
      <p className="text-sm text-slate-500">Retail price observations and inventory counts have separate histories. Wholesale orders are replenishment, not consumer sell-through. Observations show timing, not a causal effect of price changes.</p>
    </CardHeader>
    <CardContent className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">{latest.map(entry => <div key={entry.id} className="rounded-xl border p-3"><p className="font-semibold">{entry.productName} · {entry.productSize || entry.sku}</p><p>Latest observed price: {entry.currency} {Number(entry.price).toFixed(2)} · {entry.priceType}</p><p className="text-xs text-muted-foreground">{entry.observedAt ? formatEasternDateTime(entry.observedAt, entry.timeZone) : `${entry.observedOn} (time unavailable)`}{now - new Date(`${entry.observedOn}T12:00:00Z`).getTime() > 30 * 86400000 ? ' · Stale (over 30 days)' : ''}</p></div>)}</div>
      <AccountObservationForm accountId={accountId} products={products} />
      <label className="block max-w-sm space-y-1 text-sm">View price history<select className={inputClass} value={productId} onChange={event => setProductId(event.target.value)}><option value="">All products</option>{products.map(product => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label>
      {productId && visible.length > 0 && new Set(visible.map(entry => `${entry.currency}|${entry.productSize ?? entry.sku}`)).size === 1 ? <ResponsiveContainer width="100%" height={220}>
        <LineChart data={[...visible].reverse().map(entry => ({ date: entry.observedOn, price: Number(entry.price) }))} margin={{ right: 20, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
          <YAxis tickFormatter={value => `${visible[0]?.currency} ${value}`} />
          <Tooltip formatter={value => [`${visible[0]?.currency} ${Number(value).toFixed(2)}`, 'Price per bottle']} />
          <Line type="stepAfter" dataKey="price" stroke="#2563eb" strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer> : null}
      <div className="overflow-x-auto"><table className="w-full text-left text-sm">
        <thead><tr className="border-b"><th className="p-2">Date</th><th className="p-2">Product</th><th className="p-2">Price / bottle</th><th className="p-2">Notes</th><th className="p-2">Recorded by</th><th className="p-2">Actions</th></tr></thead>
        <tbody>{visible.length ? visible.map(entry => <tr key={entry.id} className="border-b">
          <td className="p-2 whitespace-nowrap">{entry.observedAt ? formatEasternDateTime(entry.observedAt, entry.timeZone) : `${entry.observedOn} (time unavailable)`}</td><td className="p-2">{entry.productName} · {entry.productSize || entry.sku}</td><td className="p-2">{entry.currency} {Number(entry.price).toFixed(2)} · {entry.priceType}</td><td className="p-2">{entry.notes || '—'}</td><td className="p-2">{entry.actorName || '—'}</td>
          <td className="p-2"><Button variant="ghost" size="sm" disabled={pending} onClick={() => {
            if (!window.confirm('Delete this price observation?')) return
            startTransition(async () => {
              try { await deleteAccountPrice(accountId, entry.id); toast.success('Price deleted'); router.refresh() }
              catch { toast.error('Could not delete price. Please try again.') }
            })
          }}>Delete</Button></td>
        </tr>) : <tr><td colSpan={6} className="p-4 text-slate-500">No prices recorded yet.</td></tr>}</tbody>
      </table></div>
      <details className="rounded-xl border p-4">
        <summary className="cursor-pointer font-semibold">Compare dated sales observations</summary>
        <p className="mt-3 text-sm text-muted-foreground">USD wholesale line totals below are confirmed/fulfilled paid orders, dated by order creation. Consumer figures cover reported tastings only; store-wide sell-through and product-level attribution are unavailable. No causal relationship is implied.</p>
        <div className="mt-3 max-h-80 overflow-auto"><table className="w-full text-left text-sm"><thead><tr><th className="p-2">Order date (Eastern)</th><th className="p-2">Product</th><th className="p-2">Wholesale quantity</th><th className="p-2">Wholesale line total</th></tr></thead><tbody>{sales.wholesale.filter(row => !productId || row.productId === productId).map(row => <tr key={row.id}><td className="p-2">{formatEasternDateTime(row.date)}</td><td className="p-2">{row.productName}</td><td className="p-2">{row.quantity} {row.unit}s</td><td className="p-2">USD {Number(row.total).toFixed(2)}</td></tr>)}</tbody></table>{!sales.wholesale.length ? <p className="p-2 text-sm">Wholesale orders unavailable.</p> : null}</div>
        <p className="mt-4 text-sm font-semibold">Consumer sell-through reported at tastings (all products)</p>
        {sales.consumer.length ? <ul className="mt-2 max-h-60 overflow-auto space-y-2 text-sm">{sales.consumer.map(row => <li key={row.id}>{formatEasternDateTime(row.date, row.timeZone)} · {row.bottlesSold == null ? 'Bottle count unavailable' : `${row.bottlesSold} bottles reported`}</li>)}</ul> : <p className="mt-2 text-sm text-muted-foreground">Consumer sell-through observations unavailable.</p>}
      </details>
    </CardContent>
  </Card>
}
