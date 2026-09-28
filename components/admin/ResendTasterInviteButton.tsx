'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { resendTasterInvite } from '@/actions/taster-invites'
import { Button } from '@/components/ui/button'

export function ResendTasterInviteButton({ userId }: { userId: string }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={async () => {
        setPending(true)
        const result = await resendTasterInvite(userId)
        setPending(false)
        if (result.success) {
          toast.success('Invitation resent')
          router.refresh()
        } else {
          toast.error('Failed to resend invitation', { description: result.error })
        }
      }}
    >
      {pending ? 'Resending...' : 'Resend Invitation'}
    </Button>
  )
}
