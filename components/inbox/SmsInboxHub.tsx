'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useActionState, useEffect, useRef, useState } from 'react'
import { Film, ImagePlus, Loader2, MessageSquare, PenSquare, Search, Send, Star, UserRound, X } from 'lucide-react'
import { toast } from 'sonner'
import { composeSmsThread, replyToSmsThread } from '@/actions/notifications'
import { saveReplyTemplate, updateSmsThreadMeta } from '@/actions/inbox'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn, formatDate } from '@/lib/utils'
import { useFormDraftAutosave } from '@/hooks/useFormDraftAutosave'

type Thread = {
  phone: string
  contactName: string
  avatarUrl: string | null
  lastBody: string
  lastDirection: 'inbound' | 'outbound'
  lastStatus: string
  lastAt: string | Date
  unreadCount: number
  status: 'open' | 'resolved'
  priority: 'normal' | 'starred'
  assignedUserId: string | null
  assignedUserName: string | null
  companyName: string | null
}

type AccountOption = {
  id: string
  label: string
  phone: string
  contactName: string
  companyName: string
  address?: string
  email?: string
  businessPhone?: string
  pocPhone?: string
}

type Message = {
  id: string
  direction: 'inbound' | 'outbound'
  body: string
  mediaUrls?: string[]
  status: string
  createdAt: string | Date
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

type ReplyTemplateOption = {
  id: string
  title: string
  category: string
  body: string
}

type AssigneeOption = {
  id: string
  name: string
}

const MAX_MMS_ATTACHMENTS = 3
const MAX_IMAGE_BYTES = 280 * 1024
const MAX_TOTAL_MMS_BYTES = 800 * 1024
const MAX_IMAGE_DIMENSION = 1280
const GIPHY_API_KEY = process.env.NEXT_PUBLIC_GIPHY_API_KEY

function isGifUrl(url: string) {
  const normalized = url.toLowerCase()
  return normalized.includes('.gif') || normalized.includes('giphy.com/media') || normalized.includes('media.giphy.com')
}

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
  accounts,
  templates,
  assignees,
}: {
  basePath: '/admin/inbox' | '/staff/inbox'
  threads: Thread[]
  selectedPhone: string | null
  selectedContactName: string
  selectedAvatarUrl: string | null
  messages: Message[]
  accounts: AccountOption[]
  templates: ReplyTemplateOption[]
  assignees: AssigneeOption[]
}) {
  const router = useRouter()
  const [state, action, pending] = useActionState(replyToSmsThread, null)
  const [composeState, composeAction, composePending] = useActionState(composeSmsThread, null)
  const [threadMetaState, threadMetaAction, threadMetaPending] = useActionState(updateSmsThreadMeta, null)
  const [templateState, templateAction, templatePending] = useActionState(saveReplyTemplate, null)
  const [localMessages, setLocalMessages] = useState(messages)
  const [attachments, setAttachments] = useState<MediaAttachment[]>([])
  const [uploading, setUploading] = useState(false)
  const [gifQuery, setGifQuery] = useState('')
  const [gifResults, setGifResults] = useState<GiphyResult[]>([])
  const [gifPickerOpen, setGifPickerOpen] = useState(false)
  const [gifLoading, setGifLoading] = useState(false)
  const [composeOpen, setComposeOpen] = useState(false)
  const [composeMode, setComposeMode] = useState<'account' | 'custom'>('account')
  const [selectedAccountPhone, setSelectedAccountPhone] = useState('')
  const [selectedAccountName, setSelectedAccountName] = useState('')
  const [customPhone, setCustomPhone] = useState('')
  const [customContactName, setCustomContactName] = useState('')
  const formRef = useRef<HTMLFormElement | null>(null)
  const composeFormRef = useRef<HTMLFormElement | null>(null)
  const templateFormRef = useRef<HTMLFormElement | null>(null)
  const handledReplyStateRef = useRef<typeof state>(null)
  const pendingReplyAttachmentsRef = useRef<MediaAttachment[]>([])
  const [threadFilter, setThreadFilter] = useState<'all' | 'unread' | 'open' | 'assigned' | 'starred'>('all')
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false)
  const replyDraft = useFormDraftAutosave(formRef, `${basePath}:reply-draft:${selectedPhone ?? 'none'}`)

  useEffect(() => {
    setLocalMessages(messages)
  }, [messages, selectedPhone])

  useEffect(() => {
    const storageKey = `${basePath}:thread-filter`
    const saved = window.localStorage.getItem(storageKey)
    if (saved === 'all' || saved === 'unread' || saved === 'open' || saved === 'assigned' || saved === 'starred') {
      setThreadFilter(saved)
    }
  }, [basePath])

  useEffect(() => {
    window.localStorage.setItem(`${basePath}:thread-filter`, threadFilter)
  }, [basePath, threadFilter])

  useEffect(() => {
    const key = `${basePath}:selected-phone`
    if (selectedPhone) {
      window.localStorage.setItem(key, selectedPhone)
      return
    }

    const savedPhone = window.localStorage.getItem(key)
    if (savedPhone && threads.some((thread) => thread.phone === savedPhone)) {
      router.replace(`${basePath}?phone=${encodeURIComponent(savedPhone)}`)
    }
  }, [basePath, router, selectedPhone, threads])

  useEffect(() => {
    if (!state || handledReplyStateRef.current === state) {
      return
    }

    handledReplyStateRef.current = state

    if (state.error) {
      toast.error('Reply failed', { description: state.error })
    } else if (state.success) {
      const formData = new FormData(formRef.current ?? undefined)
      const body = ((formData.get('body') as string) || '').trim()
      const mediaUrls = pendingReplyAttachmentsRef.current.map((attachment) => attachment.url)

      setLocalMessages((prev) => [
        ...prev,
        {
          id: `local-${Date.now()}`,
          direction: 'outbound',
          body: body || '[Image attachment]',
          mediaUrls,
          status: 'sent',
          createdAt: new Date(),
        },
      ])
      toast.success('Reply sent')
      formRef.current?.reset()
      setAttachments([])
      pendingReplyAttachmentsRef.current = []
      replyDraft.clearDraft()
      setGifPickerOpen(false)
      setGifResults([])
      setGifQuery('')
      router.refresh()
    }
  }, [router, state])

  useEffect(() => {
    if (composeState?.error) {
      toast.error('Text failed', { description: composeState.error })
      return
    }

    if (composeState?.success && composeState.phone) {
      toast.success('Text sent')
      composeFormRef.current?.reset()
      setComposeOpen(false)
      setComposeMode('account')
      setSelectedAccountPhone('')
      setSelectedAccountName('')
      setCustomPhone('')
      setCustomContactName('')
      router.push(`${basePath}?phone=${encodeURIComponent(composeState.phone)}`)
      router.refresh()
    }
  }, [basePath, composeState, router])

  useEffect(() => {
    if (threadMetaState?.error) {
      toast.error('Thread update failed', { description: threadMetaState.error })
    } else if (threadMetaState?.success) {
      router.refresh()
    }
  }, [router, threadMetaState])

  useEffect(() => {
    if (templateState?.error) {
      toast.error('Template save failed', { description: templateState.error })
    } else if (templateState?.success) {
      toast.success('Reply template saved')
      templateFormRef.current?.reset()
      setSaveTemplateOpen(false)
      router.refresh()
    }
  }, [router, templateState])

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

  const selectedThread = threads.find((thread) => thread.phone === selectedPhone) ?? null
  const selectedAccount =
    accounts.find((account) => account.phone === selectedPhone) ??
    accounts.find((account) => account.contactName === selectedContactName) ??
    null

  const filteredThreads = threads.filter((thread) => {
    if (threadFilter === 'unread') return thread.unreadCount > 0
    if (threadFilter === 'open') return thread.status === 'open'
    if (threadFilter === 'assigned') return Boolean(thread.assignedUserId)
    if (threadFilter === 'starred') return thread.priority === 'starred'
    return true
  })

  function insertTemplateBody(templateId: string) {
    setSelectedTemplateId(templateId)
    const template = templates.find((entry) => entry.id === templateId)
    const textarea = formRef.current?.querySelector('textarea[name="body"]') as HTMLTextAreaElement | null
    if (!template || !textarea) return
    textarea.value = template.body
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[340px_1fr]">
      <Card className="overflow-hidden">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-slate-500" />
              Conversations
            </CardTitle>
            <Button type="button" size="sm" variant="outline" className="gap-2" onClick={() => setComposeOpen((prev) => !prev)}>
              <PenSquare className="h-4 w-4" />
              New Text
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {[
              ['all', 'All'],
              ['unread', 'Unread'],
              ['open', 'Open'],
              ['assigned', 'Assigned'],
              ['starred', 'Starred'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setThreadFilter(value as typeof threadFilter)}
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                  threadFilter === value ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {composeOpen ? (
            <form ref={composeFormRef} action={composeAction} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Account</label>
                  <select
                    name="accountId"
                    className="flex h-10 w-full rounded-md border border-input bg-white px-3 text-sm"
                    defaultValue=""
                    onChange={(event) => {
                      const option = accounts.find((account) => account.id === event.target.value)
                      setSelectedAccountPhone(option?.phone ?? '')
                      setSelectedAccountName(option?.contactName ?? '')
                    }}
                    required
                  >
                    <option value="">Select account</option>
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2 rounded-xl border border-slate-200 bg-white p-1">
                  <button
                    type="button"
                    className={cn(
                      'flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      composeMode === 'account' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                    )}
                    onClick={() => setComposeMode('account')}
                  >
                    Saved Account
                  </button>
                  <button
                    type="button"
                    className={cn(
                      'flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      composeMode === 'custom' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                    )}
                    onClick={() => setComposeMode('custom')}
                  >
                    Custom Number
                  </button>
                </div>
                {composeMode === 'account' ? null : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Custom Contact Name</label>
                      <input
                        type="text"
                        value={customContactName}
                        onChange={(event) => setCustomContactName(event.target.value)}
                        placeholder="Optional name"
                        className="flex h-10 w-full rounded-md border border-input bg-white px-3 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Custom Phone Number</label>
                      <input
                        type="tel"
                        value={customPhone}
                        onChange={(event) => setCustomPhone(event.target.value)}
                        placeholder="+1 555 000 0000"
                        className="flex h-10 w-full rounded-md border border-input bg-white px-3 text-sm"
                      />
                    </div>
                  </div>
                )}
                <input type="hidden" name="phone" value={composeMode === 'account' ? selectedAccountPhone : customPhone} />
                <input type="hidden" name="contactName" value={composeMode === 'account' ? selectedAccountName : customContactName} />
                <textarea
                  name="body"
                  className="min-h-24 w-full rounded-xl border border-input bg-white px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  placeholder="Start a new text thread..."
                  required
                />
                <div className="flex gap-2">
                  <Button
                    type="submit"
                    size="sm"
                    disabled={composePending || !(composeMode === 'account' ? selectedAccountPhone : customPhone.trim())}
                    className="gap-2"
                  >
                    <Send className="h-4 w-4" />
                    {composePending ? 'Sending...' : 'Send'}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setComposeOpen(false)
                      setComposeMode('account')
                      setSelectedAccountPhone('')
                      setSelectedAccountName('')
                      setCustomPhone('')
                      setCustomContactName('')
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </form>
          ) : null}
          {filteredThreads.length === 0 ? (
            <p className="text-sm text-muted-foreground">No text messages yet.</p>
          ) : filteredThreads.map(thread => {
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
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-slate-900">{thread.contactName}</p>
                        {thread.priority === 'starred' ? <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /> : null}
                      </div>
                      <p className="text-xs text-slate-500">{thread.phone}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        <Badge variant={thread.status === 'open' ? 'warning' : 'secondary'}>{thread.status}</Badge>
                        {thread.assignedUserName ? <Badge variant="outline">{thread.assignedUserName}</Badge> : null}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {thread.unreadCount > 0 ? <Badge variant="destructive">{thread.unreadCount}</Badge> : null}
                    <span className="text-[11px] text-slate-400" suppressHydrationWarning>
                      {formatDate(thread.lastAt)}
                    </span>
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
              <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Thread Controls</p>
                      <p className="mt-1 text-sm text-slate-600">Route ownership, status, and priority for this conversation.</p>
                    </div>
                    {threadMetaPending ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : null}
                  </div>
                  {selectedThread ? (
                    <form action={threadMetaAction} className="mt-4 grid gap-3 sm:grid-cols-3">
                      <input type="hidden" name="phoneNumber" value={selectedThread.phone} />
                      <div className="space-y-1">
                        <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Status</label>
                        <select name="status" defaultValue={selectedThread.status} className="flex h-10 w-full rounded-md border border-input bg-white px-3 text-sm">
                          <option value="open">Open</option>
                          <option value="resolved">Resolved</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Priority</label>
                        <select name="priority" defaultValue={selectedThread.priority} className="flex h-10 w-full rounded-md border border-input bg-white px-3 text-sm">
                          <option value="normal">Normal</option>
                          <option value="starred">Starred</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Owner</label>
                        <select name="assignedUserId" defaultValue={selectedThread.assignedUserId ?? ''} className="flex h-10 w-full rounded-md border border-input bg-white px-3 text-sm">
                          <option value="">Unassigned</option>
                          {assignees.map((assignee) => (
                            <option key={assignee.id} value={assignee.id}>{assignee.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="sm:col-span-3">
                        <Button type="submit" variant="outline">Update Thread</Button>
                      </div>
                    </form>
                  ) : null}
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Account Quick View</p>
                      <p className="mt-1 text-sm text-slate-900">{selectedAccount?.companyName ?? selectedThread?.companyName ?? 'No CRM account linked'}</p>
                    </div>
                    {selectedAccount ? (
                      <Link href={`${basePath.startsWith('/admin') ? '/admin' : '/staff'}/crm/${selectedAccount.id}`} className="text-xs font-medium text-primary hover:underline">
                        View Account
                      </Link>
                    ) : null}
                  </div>
                  <div className="mt-4 space-y-2 text-sm text-slate-600">
                    <div className="flex items-center gap-2">
                      <UserRound className="h-4 w-4 text-slate-400" />
                      <span>{selectedContactName || 'Unknown contact'}</span>
                    </div>
                    <p>{selectedPhone}</p>
                    {selectedAccount?.address ? <p>{selectedAccount.address}</p> : null}
                    {selectedAccount?.email ? <p>{selectedAccount.email}</p> : null}
                    {selectedAccount?.businessPhone ? <p>Business: {selectedAccount.businessPhone}</p> : null}
                    {selectedAccount?.pocPhone ? <p>POC: {selectedAccount.pocPhone}</p> : null}
                  </div>
                </div>
              </div>

              <div className="max-h-[420px] space-y-3 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-4">
                {localMessages.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No messages in this thread yet.</p>
                ) : localMessages.map(message => (
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
                            <div className={cn(
                              'relative h-48 w-full overflow-hidden rounded-xl',
                              isGifUrl(url) ? 'bg-slate-900/85' : 'bg-black/10'
                            )}>
                              <img
                                src={url}
                                alt={isGifUrl(url) ? 'GIF attachment' : 'Message attachment'}
                                className={cn(
                                  'h-full w-full',
                                  isGifUrl(url) ? 'object-contain' : 'object-cover'
                                )}
                                loading="lazy"
                              />
                              {isGifUrl(url) ? (
                                <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
                                  GIF
                                </span>
                              ) : null}
                            </div>
                          </a>
                        ))}
                      </div>
                    ) : null}
                    {message.body && message.body !== '[Image attachment]' ? <p>{message.body}</p> : null}
                    <div className={cn('mt-2 flex items-center justify-between gap-3 text-[11px]', message.direction === 'outbound' ? 'text-blue-100' : 'text-slate-400')}>
                      <span>{message.direction === 'outbound' ? 'Outgoing' : 'Incoming'}</span>
                      <span suppressHydrationWarning>{formatDate(message.createdAt)}</span>
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
                  <select
                    value={selectedTemplateId}
                    onChange={(event) => insertTemplateBody(event.target.value)}
                    className="flex h-10 min-w-[220px] rounded-md border border-input bg-white px-3 text-sm"
                  >
                    <option value="">Insert saved reply</option>
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.category}: {template.title}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setSaveTemplateOpen((prev) => !prev)}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-100"
                  >
                    Save as template
                  </button>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                  <span className="text-slate-500">{replyDraft.statusText || 'Reply draft saves locally for this thread.'}</span>
                  <span className="text-slate-500">{pending ? 'Sending...' : 'Ready'}</span>
                </div>
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
                                <img src={gif.previewUrl} alt={gif.title} className="h-full w-full object-cover" loading="lazy" />
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
                <Button
                  type="submit"
                  disabled={pending}
                  className="gap-2"
                  onClick={() => {
                    pendingReplyAttachmentsRef.current = [...attachments]
                  }}
                >
                  <Send className="h-4 w-4" />
                  {pending ? 'Sending...' : 'Send Reply'}
                </Button>
              </form>

              {saveTemplateOpen ? (
                <form ref={templateFormRef} action={templateAction} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <input
                      name="title"
                      placeholder="Template title"
                      className="flex h-10 rounded-md border border-input bg-white px-3 text-sm"
                      required
                    />
                    <input
                      name="category"
                      placeholder="Category"
                      defaultValue="general"
                      className="flex h-10 rounded-md border border-input bg-white px-3 text-sm"
                      required
                    />
                    <Button type="submit" variant="outline" disabled={templatePending}>
                      {templatePending ? 'Saving...' : 'Save Template'}
                    </Button>
                  </div>
                  <textarea
                    name="body"
                    className="mt-3 min-h-24 w-full rounded-md border border-input bg-white px-3 py-2 text-sm"
                    placeholder="Template body"
                    defaultValue={(formRef.current?.querySelector('textarea[name="body"]') as HTMLTextAreaElement | null)?.value ?? ''}
                    required
                  />
                </form>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
