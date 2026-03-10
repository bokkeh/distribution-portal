'use client'

import { useState } from 'react'
import { MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SmsModal } from './SmsModal'

interface Props {
  phone: string
  recipientName: string
  className?: string
  title?: string
  showIcon?: boolean
}

export function PhoneSmsButton({
  phone,
  recipientName,
  className,
  title = 'Send SMS',
  showIcon = true,
}: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 hover:underline transition-colors',
          className
        )}
        title={title}
      >
        {showIcon ? <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-70" /> : null}
        <span>{phone}</span>
      </button>

      {open ? (
        <SmsModal
          phone={phone}
          recipientName={recipientName}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  )
}
