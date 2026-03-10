'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { MessageSquare, X, Send, CheckCircle } from 'lucide-react'
import { sendDirectSms } from '@/actions/notifications'

interface Props {
  phone: string
  recipientName: string
  onClose: () => void
}

const QUICK_MESSAGES = [
  'Hi, this is AHAWC. Your order is on its way this week!',
  'Hi, this is AHAWC. Please give us a call at your earliest convenience.',
  'Hi, this is AHAWC. Your invoice is ready - please log in to view and pay.',
  'Hi, this is AHAWC. We have new products available - log in to place an order!',
]

export function SmsModal({ phone, recipientName, onClose }: Props) {
  const [body, setBody] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const [saving, setSaving] = useState(false)

  function handleSend() {
    if (!body.trim()) return
    setSaving(true)
    setError(null)
    startTransition(async () => {
      const result = await sendDirectSms(phone, recipientName, body)
      if ('error' in result) {
        setError(result.error ?? 'Failed to send')
      } else {
        setSent(true)
      }
      setSaving(false)
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-blue-600" />
            <div>
              <p className="text-sm font-semibold">{recipientName}</p>
              <p className="text-xs text-muted-foreground">{phone}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-slate-900">
            <X className="h-4 w-4" />
          </button>
        </div>

        {sent ? (
          <div className="space-y-2 px-5 py-12 text-center">
            <CheckCircle className="mx-auto h-10 w-10 text-green-500" />
            <p className="font-medium">Message sent</p>
            <p className="text-sm text-muted-foreground">Delivered to {phone}</p>
            <Button className="mt-4" onClick={onClose}>Done</Button>
          </div>
        ) : (
          <div className="space-y-4 px-5 py-4">
            <div>
              <Label className="mb-2 block text-xs text-muted-foreground">Quick messages</Label>
              <div className="flex flex-col gap-1.5">
                {QUICK_MESSAGES.map(msg => (
                  <button
                    key={msg}
                    type="button"
                    onClick={() => setBody(msg)}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs text-slate-700 transition-colors hover:bg-slate-100"
                  >
                    {msg}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <Label>Message</Label>
              <textarea
                className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                rows={4}
                placeholder="Type your message..."
                value={body}
                onChange={e => setBody(e.target.value)}
                maxLength={1600}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{body.length}/1600 characters</span>
                {body.length > 160 ? (
                  <span className="text-amber-600">
                    Long message - may be split into {Math.ceil(body.length / 160)} parts
                  </span>
                ) : null}
              </div>
            </div>

            {error ? <p className="text-sm text-red-600">{error}</p> : null}

            <div className="flex justify-end gap-2 pb-1">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={handleSend} disabled={!body.trim() || saving}>
                <Send className="mr-1.5 h-3.5 w-3.5" />
                {saving ? 'Sending...' : 'Send SMS'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
