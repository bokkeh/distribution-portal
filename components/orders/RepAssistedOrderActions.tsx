'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { cancelRepAssistedOrder, resendRepAssistedNotification } from '@/actions/rep-assisted-orders'
import { Button } from '@/components/ui/button'

export function RepAssistedOrderActions({ workflowId, canCancel }: { workflowId: string; canCancel: boolean }) {
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  function resend(channel: 'email' | 'sms') {
    startTransition(async () => {
      const result = await resendRepAssistedNotification(workflowId, channel)
      if (result.error) toast.error(`Unable to resend ${channel}`, { description: result.error })
      else { toast.success(`${channel.toUpperCase()} sent`); router.refresh() }
    })
  }
  return <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={pending} onClick={() => resend('email')}>Resend email</Button><Button variant="outline" disabled={pending} onClick={() => resend('sms')}>Resend SMS</Button>{canCancel ? <Button variant="destructive" disabled={pending} onClick={() => startTransition(async () => { const result = await cancelRepAssistedOrder(workflowId); if (result.error) toast.error('Unable to cancel', { description: result.error }); else { toast.success('Order cancelled'); router.refresh() } })}>Cancel order</Button> : null}</div>
}
