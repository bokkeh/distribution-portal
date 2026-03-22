'use client'

import { useState } from 'react'
import { Send } from 'lucide-react'
import { TelnyxCallButton } from '@/components/regions/TelnyxCallButton'
import { sendMapAccountSms } from '@/actions/map-contact'

interface Props {
  phone: string
  name: string
  accountId?: string
  showNumber?: boolean
}

export function PhoneActions({ phone, name, accountId, showNumber = true }: Props) {
  const [composing, setComposing] = useState(false)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSend() {
    setSending(true)
    setError(null)
    const result = await sendMapAccountSms(phone, name, message)
    setSending(false)
    if (result.ok) {
      setSent(true)
      setMessage('')
      setTimeout(() => { setSent(false); setComposing(false) }, 2000)
    } else {
      setError(result.error ?? 'Failed to send')
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        {showNumber && <span className="text-sm text-slate-700">{phone}</span>}
        <TelnyxCallButton phone={phone} accountName={name} accountId={accountId} />
        <button
          type="button"
          onClick={() => setComposing(c => !c)}
          className="flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
        >
          <Send className="h-3 w-3" /> Text
        </button>
      </div>
      {composing && (
        <div className="space-y-1.5">
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder={`Message to ${name}…`}
            rows={2}
            className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSend}
              disabled={sending || !message.trim()}
              className="flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {sent ? 'Sent!' : sending ? 'Sending…' : 'Send'}
            </button>
            <button
              type="button"
              onClick={() => setComposing(false)}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              Cancel
            </button>
          </div>
          {error && <p className="text-[10px] text-red-500">{error}</p>}
        </div>
      )}
    </div>
  )
}
