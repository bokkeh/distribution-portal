'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Mail, X, Send, CheckCircle } from 'lucide-react'
import { sendQuickEmail } from '@/actions/notifications'

interface Props {
  email: string
  recipientName: string
  onClose: () => void
}

const QUICK_SUBJECTS = [
  { subject: 'Following up on your account', body: 'Hi, this is AHAWC. We wanted to follow up with you. Please feel free to reply or give us a call.' },
  { subject: 'New products available', body: 'Hi, this is AHAWC. We have new products available — log in to your portal to browse and place an order!' },
  { subject: 'Invoice ready for review', body: 'Hi, this is AHAWC. Your invoice is ready. Please log in to your portal to view and pay.' },
  { subject: 'Delivery scheduled this week', body: 'Hi, this is AHAWC. Your delivery is scheduled for this week. Please make sure someone is available to receive it.' },
]

export function EmailModal({ email, recipientName, onClose }: Props) {
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [, startTransition] = useTransition()

  function handleQuickSelect(quick: { subject: string; body: string }) {
    setSubject(quick.subject)
    setBody(quick.body)
  }

  function handleSend() {
    if (!subject.trim() || !body.trim()) return
    setSaving(true)
    setError(null)
    startTransition(async () => {
      const result = await sendQuickEmail(email, recipientName, subject, body)
      if ('error' in result && result.error) {
        setError(result.error)
      } else {
        setSent(true)
      }
      setSaving(false)
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-blue-600" />
            <div>
              <p className="text-sm font-semibold">{recipientName}</p>
              <p className="text-xs text-muted-foreground">{email}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-slate-900">
            <X className="h-4 w-4" />
          </button>
        </div>

        {sent ? (
          <div className="space-y-2 px-5 py-12 text-center">
            <CheckCircle className="mx-auto h-10 w-10 text-green-500" />
            <p className="font-medium">Email sent</p>
            <p className="text-sm text-muted-foreground">Delivered to {email}</p>
            <Button className="mt-4" onClick={onClose}>Done</Button>
          </div>
        ) : (
          <div className="space-y-4 px-5 py-4">
            <div>
              <Label className="mb-2 block text-xs text-muted-foreground">Quick templates</Label>
              <div className="flex flex-col gap-1.5">
                {QUICK_SUBJECTS.map(q => (
                  <button
                    key={q.subject}
                    type="button"
                    onClick={() => handleQuickSelect(q)}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs text-slate-700 transition-colors hover:bg-slate-100"
                  >
                    {q.subject}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <Label>Subject</Label>
              <Input
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="Subject line..."
                className="h-9"
              />
            </div>

            <div className="space-y-1">
              <Label>Message</Label>
              <textarea
                className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                rows={5}
                placeholder="Type your message..."
                value={body}
                onChange={e => setBody(e.target.value)}
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex justify-end gap-2 pb-1">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={handleSend} disabled={!subject.trim() || !body.trim() || saving}>
                <Send className="mr-1.5 h-3.5 w-3.5" />
                {saving ? 'Sending...' : 'Send Email'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
