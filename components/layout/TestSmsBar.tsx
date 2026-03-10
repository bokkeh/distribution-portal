'use client'

import { useState, useTransition } from 'react'
import { MessageSquare, Send, X } from 'lucide-react'
import { sendDirectSms } from '@/actions/notifications'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function TestSmsBar() {
  const [open, setOpen] = useState(false)
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function closeModal() {
    setOpen(false)
    setError(null)
    setSuccess(null)
  }

  function handleSend() {
    if (!phone.trim() || !message.trim()) {
      setError('Phone number and message are required.')
      return
    }

    setError(null)
    setSuccess(null)

    startTransition(async () => {
      const result = await sendDirectSms(phone, 'Test Recipient', message)
      if ('error' in result) {
        setError(result.error ?? 'Failed to send SMS')
        return
      }

      setSuccess(`Sent to ${phone}`)
      setPhone('')
      setMessage('')
    })
  }

  return (
    <>
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/95 px-6 py-3 backdrop-blur">
        <div>
          <p className="text-sm font-semibold text-slate-900">Testing tools</p>
          <p className="text-xs text-slate-500">Send a quick Telnyx SMS without opening an account record.</p>
        </div>
        <Button type="button" onClick={() => setOpen(true)}>
          <MessageSquare className="h-4 w-4" />
          Test SMS
        </Button>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={closeModal}>
          <div
            className="w-full max-w-lg rounded-xl bg-white shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div>
                <p className="text-base font-semibold text-slate-900">Send test SMS</p>
                <p className="text-xs text-slate-500">Uses your configured Telnyx number.</p>
              </div>
              <button type="button" onClick={closeModal} className="text-slate-400 hover:text-slate-900">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 px-5 py-4">
              <div className="space-y-2">
                <Label htmlFor="test-sms-phone">Phone number</Label>
                <Input
                  id="test-sms-phone"
                  type="tel"
                  placeholder="+12485551234"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="test-sms-message">Message</Label>
                <textarea
                  id="test-sms-message"
                  className="min-h-32 w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Type a test message..."
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  maxLength={1600}
                />
                <p className="text-xs text-slate-500">{message.length}/1600 characters</p>
              </div>

              {error ? <p className="text-sm text-red-600">{error}</p> : null}
              {success ? <p className="text-sm text-green-600">{success}</p> : null}

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={closeModal}>Close</Button>
                <Button type="button" onClick={handleSend} disabled={pending}>
                  <Send className="h-4 w-4" />
                  {pending ? 'Sending...' : 'Send test SMS'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
