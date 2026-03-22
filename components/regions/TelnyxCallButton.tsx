'use client'

import { Phone } from 'lucide-react'
import { useCall } from '@/lib/call/CallContext'

interface Props {
  phone: string
  accountName: string
  accountId?: string
}

export function TelnyxCallButton({ phone, accountName, accountId }: Props) {
  const { callState, startCall } = useCall()
  const busy = callState !== 'idle' && callState !== 'error'

  if (busy) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-green-100 px-2 py-1.5 text-xs font-medium text-green-700">
        <Phone className="h-3 w-3 animate-pulse" /> In call
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={() => startCall(phone, accountName, accountId)}
      className="flex items-center gap-1.5 rounded-md bg-green-50 px-2 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100"
    >
      <Phone className="h-3 w-3" /> Call
    </button>
  )
}
