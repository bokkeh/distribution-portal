'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { saveAccountObservations } from '@/actions/account-observations'
import { Button } from '@/components/ui/button'
import { COMMON_TIME_ZONES } from '@/lib/timezones'
import { getEasternDateKey, formatEasternTimeInput } from '@/lib/tastings/time'

export function AccountObservationForm({ accountId, products, fieldMode = false }: { accountId: string; products: { id: string; name: string; sku: string }[]; fieldMode?: boolean }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState('')
  const requestId = useRef<string | null>(null)
  const cls = `mt-1 ${fieldMode ? 'h-14 rounded-xl px-4' : 'h-11 rounded-md px-3'} w-full border border-input bg-white text-base`
  return <form className="space-y-4 rounded-xl border bg-slate-50 p-4" onSubmit={async event => {
    event.preventDefault(); if (pending) return
    const form = event.currentTarget; const data = new FormData(form)
    requestId.current ??= crypto.randomUUID(); data.set('requestId', requestId.current)
    setPending(true); setMessage('')
    try {
      const result = await saveAccountObservations(data)
      if (result.error) {
        setMessage(result.error)
        if (result.priceSaved) { const price = form.elements.namedItem('price') as HTMLInputElement; price.value = ''; requestId.current = null; router.refresh() }
        return
      }
      setMessage(`${result.inventorySaved ? 'Inventory' : ''}${result.inventorySaved && result.priceSaved ? ' and price' : result.priceSaved ? 'Price' : ''} saved.`)
      requestId.current = null; form.reset(); router.refresh()
    } catch { setMessage('Could not confirm save. Your details are kept; check your connection and retry.') }
    finally { setPending(false) }
  }}>
    <h3 className="font-semibold">Record inventory, retail price, or both</h3>
    <p className="text-sm text-muted-foreground">Leave either value blank to save only the other observation. A zero inventory count means an observed empty shelf.</p>
    <input type="hidden" name="accountId" value={accountId} />
    <fieldset disabled={pending} className="grid gap-3 sm:grid-cols-2">
      <label>Product / SKU<select className={cls} name="productId" required defaultValue=""><option value="">Choose product</option>{products.map(product => <option key={product.id} value={product.id}>{product.name} ({product.sku})</option>)}</select></label>
      <label>Inventory count (bottles, optional)<input className={cls} name="bottlesOnHand" type="number" min="0" step="1" inputMode="numeric" /></label>
      <label>Observed retail price (optional)<input className={cls} name="price" type="number" min="0" max="99999999.99" step="0.01" inputMode="decimal" /></label>
      <details open={!fieldMode} className="sm:col-span-2"><summary className="min-h-11 cursor-pointer py-3 text-sm">Size, promotion, date & notes</summary><div className="grid gap-3 sm:grid-cols-2">
      <label>Size (optional)<input className={cls} name="productSize" placeholder="e.g. 750 mL" /></label>
      <label>Currency<input className={cls} name="currency" defaultValue="USD" maxLength={3} pattern="[A-Z]{3}" /></label>
      <label>Price type<select className={cls} name="priceType" defaultValue="regular"><option value="regular">Regular</option><option value="promotional">Promotional</option></select></label>
      <label>Observation date<input className={cls} name="observedOn" type="date" required defaultValue={getEasternDateKey(new Date())} /></label>
      <label>Price observation time<input className={cls} name="observedTime" type="time" required defaultValue={formatEasternTimeInput(new Date())} /></label>
      <label>Venue timezone<select className={cls} name="timeZone" defaultValue="America/New_York">{COMMON_TIME_ZONES.map(zone => <option key={zone.value} value={zone.value}>{zone.label}</option>)}</select></label>
      <label>Notes (optional)<input className={cls} name="notes" /></label>
      </div></details>
    </fieldset>
    {message ? <p role="status" className="text-sm">{message}</p> : null}
    <Button className={fieldMode ? 'h-14 w-full text-base' : undefined} disabled={pending}>{pending ? 'Saving…' : 'Save observations'}</Button>
  </form>
}
