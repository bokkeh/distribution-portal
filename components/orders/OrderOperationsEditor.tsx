'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { saveOrderOperations } from '@/actions/order-operations'
import { fulfillmentTransitions, operationValues, type OperationValues } from '@/lib/orders/operations'
import { Button } from '@/components/ui/button'

export function OrderOperationsEditor({ orderId, initial, stripeManaged, sample, drivers }: {
  orderId: string; initial: OperationValues; stripeManaged: boolean; sample: boolean
  drivers: { id: string; name: string | null }[]
}) {
  const router = useRouter()
  const [values, setValues] = useState(initial)
  const [saved, setSaved] = useState(initial)
  const [state, setState] = useState('Saved')
  const [ready, setReady] = useState(false)
  const [conflict, setConflict] = useState(false)
  const [syncPending, setSyncPending] = useState(false)
  const busy = useRef(false)
  const dirty = JSON.stringify(values) !== JSON.stringify(saved)
  const key = `order-operations:${orderId}`
  useEffect(() => {
    try {
      const draft = sessionStorage.getItem(key)
      if (draft) {
        const parsed = JSON.parse(draft)
        const next = operationValues.parse(parsed.values)
        if (JSON.stringify(next) === JSON.stringify(initial)) {
          sessionStorage.removeItem(key)
        } else setValues(next)
        if (JSON.stringify(next) !== JSON.stringify(initial) && JSON.stringify(parsed.saved) !== JSON.stringify(initial)) {
          setConflict(true)
          setState('Failed to save: this order changed while you were away. Review your pending values.')
        }
      }
    } catch { setState('Could not restore pending edits.') }
    setReady(true)
    // Restore once on mount; a refresh must never overwrite pending edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  async function save() {
    if (busy.current || conflict || (!dirty && !syncPending)) return
    busy.current = true
    setState('Saving')
    try {
      const result = await saveOrderOperations({ orderId, expected: saved, next: values })
      if ('error' in result) {
        setState(`Failed to save: ${result.error}`)
        setConflict(Boolean(result.conflict))
      } else {
        setSaved(result.values)
        try {
          const pending = sessionStorage.getItem(key)
          if (pending && JSON.stringify(JSON.parse(pending).values) === JSON.stringify(values)) sessionStorage.removeItem(key)
        } catch { /* Persistence succeeded; a storage error must not turn it into a failed save. */ }
        setSyncPending(Boolean(result.warning))
        setState(result.warning ?? 'Saved')
        router.refresh()
      }
    } catch { setState('Failed to save: connection interrupted. Retry when connected.') }
    finally { busy.current = false }
  }

  useEffect(() => {
    if (!ready) return
    if (dirty) {
      try { sessionStorage.setItem(key, JSON.stringify({ values, saved })) }
      catch { setState('Pending changes could not be backed up in this browser. Keep this page open until saved.') }
      if (!conflict) {
        const timer = setTimeout(() => { void save() }, 400)
        return () => clearTimeout(timer)
      }
    }
    // A failed request requires explicit retry rather than an unbounded retry loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, saved, ready, conflict, key, dirty])

  useEffect(() => {
    if (!dirty) return
    const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    const navigate = (event: MouseEvent) => {
      const anchor = (event.target as Element).closest?.('a[href]')
      if (anchor && !window.confirm('Changes have not saved. Leave this page? Pending edits will be retained in this tab.')) {
        event.preventDefault(); event.stopPropagation()
      }
    }
    const navigation = (window as unknown as { navigation?: EventTarget }).navigation
    const navigationGuard = (event: Event) => {
      if (event.cancelable && !window.confirm('Changes have not saved. Leave this page? Pending edits will be retained in this tab.')) event.preventDefault()
    }
    window.addEventListener('beforeunload', unload)
    if (navigation) navigation.addEventListener('navigate', navigationGuard)
    else document.addEventListener('click', navigate, true)
    return () => {
      window.removeEventListener('beforeunload', unload)
      navigation?.removeEventListener('navigate', navigationGuard)
      document.removeEventListener('click', navigate, true)
    }
  }, [dirty])

  function field<K extends keyof OperationValues>(key: K, label: string, options: readonly string[], disabled = false) {
    return <label className="block space-y-1 text-sm" key={key}>{label}
      <select aria-label={label} className="block w-full rounded-md border p-2" value={values[key] ?? ''} disabled={disabled || state === 'Saving' || !ready}
        onChange={event => {
          if (key === 'status' && event.target.value === 'cancelled' && !window.confirm('Cancel this order? It will be excluded from active revenue totals.')) return
          setValues(current => ({ ...current, [key]: event.target.value || null }))
        }}>
        {options.map(value => <option key={value} value={value}>{value ? value.replaceAll('_', ' ') : 'Unknown / not set'}</option>)}
      </select>
    </label>
  }
  return <section className="space-y-3 rounded-lg border p-4" aria-label="Order operations">
    <h3 className="font-semibold">Order operations</h3>
    {field('paymentStatus', 'Payment status', sample ? [...new Set([values.paymentStatus, 'not_applicable'])] : ['unpaid', 'requires_action', 'processing', 'paid', 'failed', 'canceled'], stripeManaged || sample)}
    {field('paymentMethod', 'Payment method', ['', 'check', 'cod', 'manual', ...(stripeManaged || values.paymentMethod === 'stripe' ? ['stripe'] : [])], stripeManaged || sample)}
    {sample && <p className="text-xs text-slate-500">Sample orders do not require payment. Existing payment records are preserved.</p>}
    {stripeManaged && <p className="text-xs text-slate-500">Payment is managed by Stripe.</p>}
    {field('status', 'Fulfillment status', [saved.status, ...fulfillmentTransitions[saved.status]])}
    {field('shippingStatus', 'Shipping status', ['not_scheduled', 'scheduled', 'out_for_delivery', 'delivered', 'issue'])}
    <label className="block text-sm">Assigned driver
      <select aria-label="Assigned driver" className="block w-full rounded-md border p-2" disabled={!ready || state === 'Saving'} value={values.assignedDriverId ?? ''}
        onChange={event => setValues(current => ({ ...current, assignedDriverId: event.target.value || null }))}>
        <option value="">Unassigned</option>{drivers.map(driver => <option key={driver.id} value={driver.id}>{driver.name ?? driver.id}</option>)}
      </select>
    </label>
    <p className="text-xs text-slate-500">Driver assignment records responsibility; schedule the delivery route separately.</p>
    <p role="status" aria-live="polite" className="text-sm">{dirty && state === 'Saved' ? 'Saving' : state}</p>
    {(dirty || syncPending) && !conflict && <Button type="button" variant="outline" disabled={state === 'Saving'} onClick={() => void save()}>{syncPending && !dirty ? 'Retry inventory sync' : 'Retry save'}</Button>}
    {conflict && <Button type="button" variant="outline" onClick={() => {
      if (window.confirm('Discard pending edits and load the current order?')) { sessionStorage.removeItem(key); window.location.reload() }
    }}>Discard edits and reload</Button>}
  </section>
}
