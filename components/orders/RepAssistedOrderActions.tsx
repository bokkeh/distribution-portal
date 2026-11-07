'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { cancelRepAssistedOrder, resendRepAssistedNotification } from '@/actions/rep-assisted-orders'
import { Button } from '@/components/ui/button'

export function RepAssistedOrderActions({ workflowId, canCancel, defaultEmail }: { workflowId: string; canCancel: boolean; defaultEmail: string }) {
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  const [email, setEmail] = useState(defaultEmail)
  function resend(channel: 'email' | 'sms') {
    startTransition(async () => {
      const result = await resendRepAssistedNotification(workflowId, channel, channel === 'email' ? email : undefined)
      if (result.error) toast.error(`Unable to resend ${channel}`, { description: result.error })
      else { toast.success(`${channel.toUpperCase()} sent`); router.refresh() }
    })
  }
  return <div className="flex flex-wrap gap-2"><label className="w-full text-sm">Recipient email<input aria-label="Invoice recipient email" type="email" value={email} onChange={event => setEmail(event.target.value)} className="mt-2 min-h-12 w-full rounded-lg border px-3 text-base" /></label><Button variant="outline" disabled={pending} onClick={() => resend('email')}>Send / resend email</Button><Button variant="outline" disabled={pending} onClick={() => resend('sms')}>Resend SMS</Button>{canCancel ? <Button variant="destructive" disabled={pending} onClick={() => startTransition(async () => { const result = await cancelRepAssistedOrder(workflowId); if (result.error) toast.error('Unable to cancel', { description: result.error }); else { toast.success('Order cancelled'); router.refresh() } })}>Cancel order</Button> : null}</div>
}
