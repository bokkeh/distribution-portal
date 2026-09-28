'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { MAX_PO_BYTES } from '@/lib/orders/po-files'

export function OrderPoUpload({ orderId }: { orderId: string }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState('')
  return <form className="space-y-2" onSubmit={async event => {
    event.preventDefault()
    if (pending) return
    const element = event.currentTarget
    const form = new FormData(element)
    const file = form.get('file')
    if (!(file instanceof File) || !file.size || file.size > MAX_PO_BYTES) { setMessage('Choose a file up to 4 MB.'); return }
    setPending(true)
    setMessage('')
    try {
      const response = await fetch(`/api/orders/${orderId}/po`, { method: 'POST', body: form })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'Upload failed.')
      element.reset()
      setMessage('PO uploaded.')
      router.refresh()
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Upload failed.') }
    finally { setPending(false) }
  }}>
    <label htmlFor="order-po-file" className="text-sm font-medium">Upload Purchase Order</label>
    <input id="order-po-file" name="file" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx" required disabled={pending} className="block w-full text-sm" />
    <p className="text-xs text-slate-500">PDF, images or Word documents. Maximum 4 MB. Optional.</p>
    <Button size="sm" variant="outline" disabled={pending}>{pending ? 'Uploading…' : 'Upload PO'}</Button>
    {message ? <p role="status" className="text-sm">{message}</p> : null}
  </form>
}
