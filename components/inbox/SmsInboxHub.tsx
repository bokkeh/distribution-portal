'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useActionState, useEffect, useRef, useState } from 'react'
import { Film, ImagePlus, Loader2, MessageSquare, Search, Send, X } from 'lucide-react'
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
  mediaUrls?: string[]
  status: string
  createdAt: Date
}

type MediaAttachment = {
  url: string
  size: number
  label?: string
}

type GiphyResult = {
  id: string
  title: string
  url: string
  size: number
  previewUrl: string
}

const MAX_MMS_ATTACHMENTS = 3
const MAX_IMAGE_BYTES = 280 * 1024
const MAX_TOTAL_MMS_BYTES = 800 * 1024
const MAX_IMAGE_DIMENSION = 1280
const GIPHY_API_KEY = process.env.NEXT_PUBLIC_GIPHY_API_KEY

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
  const [gifQuery, setGifQuery] = useState('')
  const [gifResults, setGifResults] = useState<GiphyResult[]>([])
  const [gifPickerOpen, setGifPickerOpen] = useState(false)
  const [gifLoading, setGifLoading] = useState(false)
  const formRef = useRef<HTMLFormElement | null>(null)

  useEffect(() => {
    if (state?.error) {
      toast.error('Reply failed', { description: state.error })
    } else if (state?.success) {
      toast.success('Reply sent')
      formRef.current?.reset()
      setAttachments([])
      setGifPickerOpen(false)
      setGifResults([])
      setGifQuery('')
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

      const absoluteUrl =
        typeof payload?.publicUrl === 'string' && payload.publicUrl.startsWith('/')
          ? `${window.location.origin}${payload.publicUrl}`
          : payload?.publicUrl

      if (!absoluteUrl || typeof absoluteUrl !== 'string') {
        throw new Error('Upload returned an invalid image URL.')
      }

      setAttachments((prev) => [...prev, { url: absoluteUrl, size: compressedFile.size }])
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

  async function searchGifs() {
    if (!GIPHY_API_KEY) {
      toast.error('Giphy is not configured', { description: 'Set NEXT_PUBLIC_GIPHY_API_KEY to enable GIF replies.' })
      return
    }

    const query = gifQuery.trim()
    if (!query) {
      toast.error('Enter a search term', { description: 'Search for a GIF before opening results.' })
      return
    }

    setGifLoading(true)
    try {
      const response = await fetch(
        `https://api.giphy.com/v1/gifs/search?api_key=${encodeURIComponent(GIPHY_API_KEY)}&q=${encodeURIComponent(query)}&limit=12&rating=g`
      )
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(payload?.message || 'Failed to search Giphy')
      }

      const results: GiphyResult[] = (payload?.data ?? [])
        .map((item: any) => {
          const image = item?.images?.fixed_height_small
          if (!image?.url) return null

          return {
            id: item.id,
            title: item.title || 'GIF',
            url: image.url as string,
            size: Number(image.size || 0),
            previewUrl: image.webp || image.url,
          }
        })
        .filter(Boolean)

      setGifResults(results)
    } catch (error) {
      toast.error('GIF search failed', { description: error instanceof Error ? error.message : undefined })
    } finally {
      setGifLoading(false)
    }
  }

  function attachGif(gif: GiphyResult) {
    if (attachments.length >= MAX_MMS_ATTACHMENTS) {
      toast.error('Attachment limit reached', { description: `You can attach up to ${MAX_MMS_ATTACHMENTS} items per reply.` })
      return
    }

    const currentTotalBytes = attachments.reduce((sum, attachment) => sum + attachment.size, 0)
    if (currentTotalBytes + gif.size > MAX_TOTAL_MMS_BYTES) {
      toast.error('GIF too large', { description: 'This GIF would push the MMS payload over the safe send limit.' })
      return
    }

    setAttachments((prev) => {
      if (prev.some((attachment) => attachment.url === gif.url)) return prev
      return [...prev, { url: gif.url, size: gif.size, label: gif.title || 'GIF' }]
    })
    setGifPickerOpen(false)
    toast.success('GIF attached')
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
                    {message.mediaUrls?.length ? (
                      <div className="mb-2 grid gap-2">
                        {message.mediaUrls.map((url) => (
                          <a key={url} href={url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl">
                            <div className="relative h-48 w-full overflow-hidden rounded-xl bg-black/10">
                              <Image src={url} alt="Message attachment" fill unoptimized className="object-cover" />
                            </div>
                          </a>
                        ))}
                      </div>
                    ) : null}
                    {message.body && message.body !== '[Image attachment]' ? <p>{message.body}</p> : null}
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
                  <button
                    type="button"
                    onClick={() => setGifPickerOpen((prev) => !prev)}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-100"
                  >
                    <Film className="h-4 w-4" />
                    Add GIF
                  </button>
                  <span className="text-xs text-slate-500">
                    Up to {MAX_MMS_ATTACHMENTS} images, max {(MAX_TOTAL_MMS_BYTES / 1024).toFixed(0)} KB total.
                  </span>
                  {gifPickerOpen ? (
                    <div className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <div className="relative flex-1">
                          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <input
                            type="text"
                            value={gifQuery}
                            onChange={(event) => setGifQuery(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') {
                                event.preventDefault()
                                void searchGifs()
                              }
                            }}
                            placeholder="Search Giphy"
                            className="h-10 w-full rounded-xl border border-input bg-white pl-9 pr-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          />
                        </div>
                        <Button type="button" variant="outline" onClick={() => void searchGifs()} disabled={gifLoading}>
                          {gifLoading ? 'Searching...' : 'Search'}
                        </Button>
                      </div>
                      {!GIPHY_API_KEY ? (
                        <p className="mt-3 text-xs text-amber-700">Set `NEXT_PUBLIC_GIPHY_API_KEY` to enable GIF search.</p>
                      ) : null}
                      {gifResults.length ? (
                        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                          {gifResults.map((gif) => (
                            <button
                              key={gif.id}
                              type="button"
                              onClick={() => attachGif(gif)}
                              className="overflow-hidden rounded-xl border border-slate-200 bg-white text-left hover:border-slate-300"
                            >
                              <div className="relative aspect-square bg-slate-100">
                                <Image src={gif.previewUrl} alt={gif.title} fill unoptimized className="object-cover" />
                              </div>
                              <div className="px-2 py-2">
                                <p className="line-clamp-2 text-xs font-medium text-slate-700">{gif.title || 'GIF'}</p>
                                <p className="mt-1 text-[11px] text-slate-400">{Math.round(gif.size / 1024)} KB</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : gifLoading ? null : (
                        <p className="mt-3 text-xs text-slate-500">Search for a GIF to attach to this reply.</p>
                      )}
                    </div>
                  ) : null}
                  {attachments.length ? (
                    <div className="flex flex-wrap gap-2">
                      {attachments.map((attachment, index) => (
                        <div key={attachment.url} className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">
                          <a href={attachment.url} target="_blank" rel="noreferrer" className="underline">
                            {attachment.label || `Image ${index + 1}`}
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
