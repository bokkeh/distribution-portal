'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateOrderDeliveryDate } from '@/actions/order-delivery'
import { getDeliveryDueDate } from '@/lib/orders/delivery-date'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function OrderDeliveryDateForm({ orderId, deliveryDate, paymentTerms }: {
  orderId: string; deliveryDate: string | null; paymentTerms: string | null
}) {
  const [date, setDate] = useState(deliveryDate ?? '')
  const [message, setMessage] = useState('')
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  const due = getDeliveryDueDate(deliveryDate, paymentTerms)
  return <form className="space-y-2 border-t pt-3" onSubmit={event => {
    event.preventDefault()
    startTransition(async () => {
      try {
        const result = await updateOrderDeliveryDate(orderId, date)
        setMessage(result.error ?? 'Delivery date saved.')
        if (!result.error) router.refresh()
      } catch { setMessage('Unable to save delivery date. Please try again.') }
    })
  }}>
    <Label htmlFor="order-delivery-date">Delivery Date</Label>
    <Input id="order-delivery-date" type="date" value={date} onChange={event => setDate(event.target.value)} disabled={pending} />
    <p className="text-xs text-slate-500">{due ? `Due Date (from delivery): ${due}` : !deliveryDate ? 'Awaiting delivery date; payment terms have not started.' : 'No delivery-based due date for these payment terms.'}</p>
    <p className="text-xs text-slate-500">Existing invoice due dates are managed separately.</p>
    <Button size="sm" variant="outline" disabled={pending}>{pending ? 'Saving…' : 'Save Delivery Date'}</Button>
    {message ? <p role="status" className="text-xs">{message}</p> : null}
  </form>
}
