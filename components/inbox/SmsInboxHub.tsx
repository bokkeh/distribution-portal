'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useActionState, useEffect, useRef, useState } from 'react'
import { ImagePlus, Loader2, MessageSquare, Send, X } from 'lucide-react'
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

type MediaAttachment = {
  url: string
  size: number
}

const MAX_MMS_ATTACHMENTS = 3
const MAX_IMAGE_BYTES = 280 * 1024
const MAX_TOTAL_MMS_BYTES = 800 * 1024
const MAX_IMAGE_DIMENSION = 1280

async function compressImageForMms(file: File) {
  if (!file.type.startsWith('image/')) {
    throw new Error('Only image uploads are supported.')
  }

  const imageUrl = URL.createObjectURL(file)

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const nextImage = new window.Image()
      nextImage.onload = () => resolve(nextImage)
      nextImage.onerror = () => reject(new Error('Unable to read image.'))
      nextImage.src = imageUrl
    })

    let width = image.width
    let height = image.height
    const longestSide = Math.max(width, height)

    if (longestSide > MAX_IMAGE_DIMENSION) {
      const scale = MAX_IMAGE_DIMENSION / longestSide
      width = Math.max(1, Math.round(width * scale))
      height = Math.max(1, Math.round(height * scale))
    }

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height

    const context = canvas.getContext('2d')
    if (!context) {
      throw new Error('Unable to process image.')
    }

    context.drawImage(image, 0, 0, width, height)

    let quality = 0.82
    let blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))

    while (blob && blob.size > MAX_IMAGE_BYTES && quality > 0.45) {
      quality -= 0.1
      blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
    }

    if (!blob) {
      throw new Error('Unable to compress image.')
    }

    if (blob.size > MAX_IMAGE_BYTES) {
      throw new Error('Image is still too large after compression. Please choose a smaller image.')
    }

    const normalizedName = file.name.replace(/\.[^.]+$/, '') || 'attachment'
    return new File([blob], `${normalizedName}.jpg`, { type: 'image/jpeg' })
  } finally {
    URL.revokeObjectURL(imageUrl)
  }
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
  const [attachments, setAttachments] = useState<MediaAttachment[]>([])
  const [uploading, setUploading] = useState(false)
  const formRef = useRef<HTMLFormElement | null>(null)

  useEffect(() => {
    if (state?.error) {
      toast.error('Reply failed', { description: state.error })
    } else if (state?.success) {
      toast.success('Reply sent')
      formRef.current?.reset()
      setAttachments([])
    }
  }, [state])

  async function handleUpload(file: File) {
    if (attachments.length >= MAX_MMS_ATTACHMENTS) {
      toast.error('Attachment limit reached', { description: `You can attach up to ${MAX_MMS_ATTACHMENTS} images per reply.` })
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File too large', { description: 'Maximum 10MB.' })
      return
    }

    setUploading(true)
    try {
      const compressedFile = await compressImageForMms(file)
      const currentTotalBytes = attachments.reduce((sum, attachment) => sum + attachment.size, 0)
      if (currentTotalBytes + compressedFile.size > MAX_TOTAL_MMS_BYTES) {
        throw new Error('These attachments are too large together for MMS. Remove one or choose a smaller image.')
      }

      const formData = new FormData()
      formData.append('file', compressedFile)
      formData.append('folder', 'sms-inbox')
      formData.append('filename', compressedFile.name)

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(payload?.error || 'Upload failed')
      }

      setAttachments((prev) => [...prev, { url: payload.publicUrl, size: compressedFile.size }])
      toast.success('Image attached')
    } catch (error) {
      toast.error('Upload failed', { description: error instanceof Error ? error.message : undefined })
    } finally {
      setUploading(false)
    }
  }

  function removeMediaUrl(url: string) {
    setAttachments((prev) => prev.filter((item) => item.url !== url))
  }

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

              <form ref={formRef} action={action} className="space-y-3">
                <input type="hidden" name="phone" value={selectedPhone} />
                <input type="hidden" name="contactName" value={selectedContactName} />
                <input type="hidden" name="redirectPath" value={`${basePath}?phone=${encodeURIComponent(selectedPhone)}`} />
                {attachments.map((attachment) => (
                  <input key={attachment.url} type="hidden" name="mediaUrl" value={attachment.url} />
                ))}
                <textarea
                  name="body"
                  className="min-h-28 w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  placeholder="Type your reply..."
                />
                <div className="flex flex-wrap items-center gap-3">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-100">
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                    {uploading ? 'Uploading...' : 'Attach Image'}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0]
                        if (file) void handleUpload(file)
                        event.currentTarget.value = ''
                      }}
                    />
                  </label>
                  <span className="text-xs text-slate-500">
                    Up to {MAX_MMS_ATTACHMENTS} images, max {(MAX_TOTAL_MMS_BYTES / 1024).toFixed(0)} KB total.
                  </span>
                  {attachments.length ? (
                    <div className="flex flex-wrap gap-2">
                      {attachments.map((attachment, index) => (
                        <div key={attachment.url} className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">
                          <a href={attachment.url} target="_blank" rel="noreferrer" className="underline">
                            Image {index + 1}
                          </a>
                          <span className="text-slate-400">{Math.round(attachment.size / 1024)} KB</span>
                          <button type="button" onClick={() => removeMediaUrl(attachment.url)} className="text-slate-400 hover:text-slate-700">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
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
