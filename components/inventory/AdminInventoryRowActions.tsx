'use client'

import Link from 'next/link'
import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRightLeft, MoreHorizontal, PackageCheck, X } from 'lucide-react'
import { toast } from 'sonner'
import { checkoutSamples, closeSampleAssignment, transferInventory } from '@/actions/inventory-allocations'
import { deleteSku } from '@/actions/inventory'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatStock } from '@/lib/inventory/units'

type Holder = { id: string; userId: string; userName: string; bottles: number; notes: string | null }
type StaffUser = { id: string; name: string; role: string }

export function AdminInventoryRowActions({
  productId, productName, editHref, warehouseBottles, sampleBottles, bottlesPerCase, holders, staffUsers,
}: {
  productId: string
  productName: string
  editHref?: string
  warehouseBottles: number
  sampleBottles: number
  bottlesPerCase: number
  holders: Holder[]
  staffUsers: StaffUser[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'transfer' | 'checkout'>('transfer')
  const [direction, setDirection] = useState('warehouse_to_samples')
  const [quantity, setQuantity] = useState('1')
  const [unit, setUnit] = useState<'cases' | 'bottles'>('cases')
  const [userId, setUserId] = useState('')
  const [notes, setNotes] = useState('')
  const checkedOutBottles = useMemo(() => holders.reduce((sum, holder) => sum + holder.bottles, 0), [holders])
  const requestedBottles = Math.max(0, Number.parseInt(quantity || '0', 10) || 0) * (unit === 'cases' ? bottlesPerCase : 1)
  const sourceBottles = direction === 'warehouse_to_samples' ? warehouseBottles : sampleBottles
  const nextWarehouse = warehouseBottles + (direction === 'warehouse_to_samples' ? -requestedBottles : requestedBottles)
  const nextSamples = sampleBottles + (direction === 'warehouse_to_samples' ? requestedBottles : -requestedBottles)

  function runAction(action: () => Promise<{ success: true } | { error: string }>, successMessage: string) {
    startTransition(async () => {
      const result = await action()
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      toast.success(successMessage)
      setOpen(false)
      setQuantity('1')
      setNotes('')
      router.refresh()
    })
  }

  function submit() {
    const formData = new FormData()
    formData.set('productId', productId)
    formData.set('quantity', quantity)
    formData.set('unit', unit)
    if (mode === 'transfer') {
      formData.set('direction', direction)
      runAction(() => transferInventory(formData), 'Inventory allocated')
    } else {
      formData.set('userId', userId)
      formData.set('notes', notes)
      runAction(() => checkoutSamples(formData), 'Samples checked out')
    }
  }

  function closeAssignment(holderId: string, disposition: string) {
    const formData = new FormData()
    formData.set('holderId', holderId)
    formData.set('disposition', disposition)
    runAction(() => closeSampleAssignment(formData), disposition === 'returned' ? 'Samples returned to stock' : `Samples marked ${disposition}`)
  }

  function handleDelete() {
    if (!window.confirm('Delete this SKU? If it has order history it will be retired instead of deleted.')) return
    const formData = new FormData()
    formData.set('productId', productId)
    startTransition(async () => {
      const result = await deleteSku(formData)
      if (result?.error) {
        toast.error(result.error)
        return
      }
      toast.success(result?.retired ? 'SKU retired' : 'SKU deleted')
      router.refresh()
    })
  }

  return (
    <>
      <td className="px-6 py-4 text-sm font-medium">{formatStock(warehouseBottles, bottlesPerCase)}</td>
      <td className="px-6 py-4 text-sm"><span className={sampleBottles === 0 ? 'text-muted-foreground' : ''}>{formatStock(sampleBottles, bottlesPerCase)}</span></td>
      <td className="px-6 py-4 text-sm"><span className={checkedOutBottles === 0 ? 'text-muted-foreground' : ''}>{formatStock(checkedOutBottles, bottlesPerCase)}</span></td>
      <td className="px-6 py-4">
        <div className="flex items-center justify-end gap-2">
          <Button size="sm" onClick={() => setOpen(true)}><ArrowRightLeft className="mr-2 h-4 w-4" />Allocate</Button>
          <details className="relative">
            <summary className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-md border hover:bg-slate-50"><MoreHorizontal className="h-4 w-4" /></summary>
            <div className="absolute right-0 z-20 mt-1 w-36 rounded-md border bg-white p-1 shadow-lg">
              <Link className="block rounded px-3 py-2 text-sm hover:bg-slate-50" href={editHref ?? `/admin/inventory/${productId}`}>Edit product</Link>
              <button className="block w-full rounded px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50" onClick={handleDelete}>Delete / retire</button>
            </div>
          </details>
        </div>
      </td>

      {open && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40" role="dialog" aria-modal="true" aria-label={`Allocate ${productName} inventory`}>
          <button className="absolute inset-0 cursor-default" aria-label="Close allocation panel" onClick={() => setOpen(false)} />
          <div className="relative flex h-full w-full max-w-xl flex-col overflow-y-auto bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b p-6">
              <div><p className="text-xs font-medium uppercase tracking-wide text-blue-600">Inventory allocation</p><h2 className="mt-1 text-xl font-semibold">{productName}</h2></div>
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)}><X className="h-4 w-4" /></Button>
            </div>
            <div className="space-y-6 p-6">
              <div className="grid grid-cols-3 gap-3">
                {[['Warehouse', warehouseBottles], ['Samples available', sampleBottles], ['Checked out', checkedOutBottles]].map(([label, count]) => (
                  <div key={String(label)} className="rounded-xl border bg-slate-50 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-sm font-semibold">{formatStock(Number(count), bottlesPerCase)}</p></div>
                ))}
              </div>
              <div className="flex rounded-lg bg-slate-100 p-1">
                <button className={`flex-1 rounded-md px-3 py-2 text-sm font-medium ${mode === 'transfer' ? 'bg-white shadow-sm' : ''}`} onClick={() => setMode('transfer')}>Move stock</button>
                <button className={`flex-1 rounded-md px-3 py-2 text-sm font-medium ${mode === 'checkout' ? 'bg-white shadow-sm' : ''}`} onClick={() => setMode('checkout')}>Check out samples</button>
              </div>
              {mode === 'transfer' ? (
                <div className="space-y-4">
                  <label className="block space-y-1.5"><span className="text-sm font-medium">Move</span><select value={direction} onChange={e => setDirection(e.target.value)} className="h-10 w-full rounded-md border bg-white px-3 text-sm"><option value="warehouse_to_samples">Warehouse → Samples</option><option value="samples_to_warehouse">Samples → Warehouse</option></select></label>
                  <QuantityFields quantity={quantity} setQuantity={setQuantity} unit={unit} setUnit={setUnit} bottlesPerCase={bottlesPerCase} />
                  <div className={`rounded-xl border p-4 ${requestedBottles > sourceBottles ? 'border-red-200 bg-red-50' : 'border-blue-200 bg-blue-50'}`}>
                    <p className="text-sm font-medium">After this move</p>
                    <div className="mt-2 flex justify-between text-sm"><span>Warehouse</span><span>{formatStock(Math.max(0, nextWarehouse), bottlesPerCase)}</span></div>
                    <div className="mt-1 flex justify-between text-sm"><span>Samples available</span><span>{formatStock(Math.max(0, nextSamples), bottlesPerCase)}</span></div>
                    {requestedBottles > sourceBottles && <p className="mt-2 text-xs font-medium text-red-600">Not enough stock in the selected source.</p>}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <label className="block space-y-1.5"><span className="text-sm font-medium">Staff member</span><select value={userId} onChange={e => setUserId(e.target.value)} className="h-10 w-full rounded-md border bg-white px-3 text-sm"><option value="">Select staff...</option>{staffUsers.map(user => <option key={user.id} value={user.id}>{user.name} ({user.role})</option>)}</select></label>
                  <QuantityFields quantity={quantity} setQuantity={setQuantity} unit={unit} setUnit={setUnit} bottlesPerCase={bottlesPerCase} />
                  <label className="block space-y-1.5"><span className="text-sm font-medium">Notes <span className="font-normal text-muted-foreground">(optional)</span></span><Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Event, account, or purpose" /></label>
                </div>
              )}
              {holders.length > 0 && <div className="space-y-3 border-t pt-6"><div><h3 className="font-semibold">Current sample holders</h3><p className="text-sm text-muted-foreground">Return unused stock or record samples that were consumed, damaged, or lost.</p></div>{holders.map(holder => <div key={holder.id} className="rounded-xl border p-4"><div className="flex items-start justify-between gap-4"><div><p className="font-medium">{holder.userName}</p><p className="text-sm text-muted-foreground">{formatStock(holder.bottles, bottlesPerCase)}{holder.notes ? ` · ${holder.notes}` : ''}</p></div><div className="flex flex-wrap justify-end gap-2"><Button size="sm" variant="outline" onClick={() => closeAssignment(holder.id, 'returned')} disabled={isPending}>Return</Button><select aria-label="Close sample assignment" className="h-9 rounded-md border bg-white px-2 text-xs" defaultValue="" onChange={e => { if (e.target.value) closeAssignment(holder.id, e.target.value) }}><option value="" disabled>Other…</option><option value="consumed">Consumed</option><option value="damaged">Damaged</option><option value="lost">Lost</option></select></div></div></div>)}</div>}
            </div>
            <div className="sticky bottom-0 mt-auto flex justify-end gap-3 border-t bg-white p-6"><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={submit} disabled={isPending || !quantity || requestedBottles < 1 || (mode === 'transfer' ? requestedBottles > sourceBottles : !userId || requestedBottles > sampleBottles)}>{isPending ? 'Saving…' : mode === 'transfer' ? 'Confirm allocation' : <><PackageCheck className="mr-2 h-4 w-4" />Check out samples</>}</Button></div>
          </div>
        </div>
      )}
    </>
  )
}

function QuantityFields({ quantity, setQuantity, unit, setUnit, bottlesPerCase }: { quantity: string; setQuantity: (value: string) => void; unit: 'cases' | 'bottles'; setUnit: (value: 'cases' | 'bottles') => void; bottlesPerCase: number }) {
  return <div className="grid grid-cols-2 gap-3"><label className="space-y-1.5"><span className="text-sm font-medium">Quantity</span><Input type="number" min="1" step="1" value={quantity} onChange={e => setQuantity(e.target.value)} /></label><label className="space-y-1.5"><span className="text-sm font-medium">Unit</span><select value={unit} onChange={e => setUnit(e.target.value as 'cases' | 'bottles')} className="h-10 w-full rounded-md border bg-white px-3 text-sm"><option value="cases">Cases ({bottlesPerCase} bottles)</option><option value="bottles">Bottles</option></select></label></div>
}
