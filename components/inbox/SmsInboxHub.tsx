'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useActionState, useEffect } from 'react'
import { MessageSquare, Send } from 'lucide-react'
import { toast } from 'sonner'
import { replyToSmsThread } from '@/actions/notifications'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn, formatDate } from '@/lib/utils'

type Thread = {
  phone: string
  contactName: string
  avatarUrl: string | null
  lastBody: string
  lastDirection: 'inbound' | 'outbound'
  lastStatus: string
  lastAt: Date
  unreadCount: number
}

type Message = {
  id: string
  direction: 'inbound' | 'outbound'
  body: string
  status: string
  createdAt: Date
}

export function SmsInboxHub({
  basePath,
  threads,
  selectedPhone,
  selectedContactName,
  selectedAvatarUrl,
  messages,
}: {
  basePath: '/admin/inbox' | '/staff/inbox'
  threads: Thread[]
  selectedPhone: string | null
  selectedContactName: string
  selectedAvatarUrl: string | null
  messages: Message[]
}) {
  const [state, action, pending] = useActionState(replyToSmsThread, null)

  useEffect(() => {
    if (state?.error) {
      toast.error('Reply failed', { description: state.error })
    } else if (state?.success) {
      toast.success('Reply sent')
    }
  }, [state])

  return (
    <div className="grid gap-6 xl:grid-cols-[340px_1fr]">
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-slate-500" />
            Conversations
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {threads.length === 0 ? (
            <p className="text-sm text-muted-foreground">No text messages yet.</p>
          ) : threads.map(thread => {
            const active = selectedPhone === thread.phone
            const initials = thread.contactName.trim().slice(0, 1).toUpperCase() || '?'
            return (
              <Link
                key={thread.phone}
                href={`${basePath}?phone=${encodeURIComponent(thread.phone)}`}
                className={cn(
                  'block rounded-xl border p-3 transition-colors',
                  active ? 'border-blue-300 bg-blue-50' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    {thread.avatarUrl ? (
                      <Image
                        src={thread.avatarUrl}
                        alt={thread.contactName}
                        width={40}
                        height={40}
                        className="h-10 w-10 rounded-full object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 text-sm font-semibold text-slate-600">
                        {initials}
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-slate-900">{thread.contactName}</p>
                      <p className="text-xs text-slate-500">{thread.phone}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {thread.unreadCount > 0 ? <Badge variant="destructive">{thread.unreadCount}</Badge> : null}
                    <span className="text-[11px] text-slate-400">{formatDate(thread.lastAt)}</span>
                  </div>
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-slate-600">{thread.lastBody}</p>
              </Link>
            )
          })}
        </CardContent>
      </Card>

      <Card className="min-h-[520px]">
        <CardHeader>
          {selectedPhone ? (
            <div className="flex items-center gap-3">
              {selectedAvatarUrl ? (
                <Image
                  src={selectedAvatarUrl}
                  alt={selectedContactName}
                  width={44}
                  height={44}
                  className="h-11 w-11 rounded-full object-cover"
                  unoptimized
                />
              ) : (
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-200 text-sm font-semibold text-slate-600">
                  {selectedContactName.trim().slice(0, 1).toUpperCase() || '?'}
                </div>
              )}
              <div>
                <CardTitle>{selectedContactName}</CardTitle>
                <p className="text-sm text-muted-foreground">{selectedPhone}</p>
              </div>
            </div>
          ) : (
            <CardTitle>Select a conversation</CardTitle>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {!selectedPhone ? (
            <p className="text-sm text-muted-foreground">Choose a thread to read and reply.</p>
          ) : (
            <>
              <div className="max-h-[420px] space-y-3 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-4">
                {messages.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No messages in this thread yet.</p>
                ) : messages.map(message => (
                  <div
                    key={message.id}
                    className={cn(
                      'max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm',
                      message.direction === 'outbound'
                        ? 'ml-auto bg-blue-600 text-white'
                        : 'bg-white text-slate-800'
                    )}
                  >
                    <p>{message.body}</p>
                    <div className={cn('mt-2 flex items-center justify-between gap-3 text-[11px]', message.direction === 'outbound' ? 'text-blue-100' : 'text-slate-400')}>
                      <span>{message.direction === 'outbound' ? 'Outgoing' : 'Incoming'}</span>
                      <span>{formatDate(message.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>

              <form action={action} className="space-y-3">
                <input type="hidden" name="phone" value={selectedPhone} />
                <input type="hidden" name="contactName" value={selectedContactName} />
                <input type="hidden" name="redirectPath" value={`${basePath}?phone=${encodeURIComponent(selectedPhone)}`} />
                <textarea
                  name="body"
                  className="min-h-28 w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  placeholder="Type your reply..."
                  required
                />
                <Button type="submit" disabled={pending} className="gap-2">
                  <Send className="h-4 w-4" />
                  {pending ? 'Sending...' : 'Send Reply'}
                </Button>
              </form>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
