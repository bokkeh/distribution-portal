'use client'

import { useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/button'

export function InvoiceSendButton({ draft }: { draft: boolean }) {
  const { pending } = useFormStatus()
  return <Button type="submit" disabled={pending} className="min-h-12 w-full">
    {pending ? 'Sending…' : draft ? 'Send invoice' : 'Resend invoice'}
  </Button>
}
