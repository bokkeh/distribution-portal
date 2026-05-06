'use client'

import { DragEvent, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { FileSpreadsheet, FileText, ImagePlus, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { addAccountMedia } from '@/actions/crm-account'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const ACCOUNT_MEDIA_CATEGORY_OPTIONS = [
  { value: 'tasting', label: 'Tasting' },
  { value: 'store_visit', label: 'Store Visit' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'customers', label: 'Customers' },
  { value: 'employees', label: 'Employees' },
  { value: 'events', label: 'Events' },
] as const

const SUPPORTED_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'png', 'webp',
  'pdf',
  'doc', 'docx',
  'xls', 'xlsx', 'csv',
  'ppt', 'pptx',
  'txt', 'rtf',
])

const SUPPORTED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'application/rtf',
  'text/rtf',
])

type AccountMediaType = 'image' | 'pdf' | 'word' | 'spreadsheet' | 'presentation' | 'document'

function todayValue() {
  return new Date().toISOString().slice(0, 10)
}

function getFileExtension(filename: string) {
  const ext = filename.split('.').pop()
  return ext ? ext.toLowerCase() : ''
}

function resolveAccountMediaType(file: File): AccountMediaType | null {
  const extension = getFileExtension(file.name)
  const type = file.type.toLowerCase()

  if (type.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp'].includes(extension)) {
    return 'image'
  }
  if (type === 'application/pdf' || extension === 'pdf') {
    return 'pdf'
  }
  if (
    type === 'application/msword' ||
    type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    ['doc', 'docx', 'rtf', 'txt'].includes(extension)
  ) {
    return 'word'
  }
  if (
    type === 'application/vnd.ms-excel' ||
    type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    type === 'text/csv' ||
    ['xls', 'xlsx', 'csv'].includes(extension)
  ) {
    return 'spreadsheet'
  }
  if (
    type === 'application/vnd.ms-powerpoint' ||
    type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
    ['ppt', 'pptx'].includes(extension)
  ) {
    return 'presentation'
  }
  if (SUPPORTED_EXTENSIONS.has(extension) || SUPPORTED_MIME_TYPES.has(type)) {
    return 'document'
  }

  return null
}

function getPreviewMeta(mediaType: AccountMediaType) {
  if (mediaType === 'image') return { icon: ImagePlus, label: 'Image file' }
  if (mediaType === 'spreadsheet') return { icon: FileSpreadsheet, label: 'Spreadsheet file' }
  if (mediaType === 'presentation') return { icon: FileText, label: 'Presentation file' }
  if (mediaType === 'word') return { icon: FileText, label: 'Word or text document' }
  if (mediaType === 'pdf') return { icon: FileText, label: 'PDF document' }
  return { icon: FileText, label: 'Document file' }
}

export function AccountMediaUploadCard({ accountId }: { accountId: string }) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [isPending, startTransition] = useTransition()
  const [uploading, setUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [mediaUrl, setMediaUrl] = useState('')
  const [mediaType, setMediaType] = useState<AccountMediaType | null>(null)
  const [fileName, setFileName] = useState('')
  const [caption, setCaption] = useState('')
  const [category, setCategory] = useState<(typeof ACCOUNT_MEDIA_CATEGORY_OPTIONS)[number]['value']>('store_visit')
  const [taggedDate, setTaggedDate] = useState(todayValue())

  async function handleFileSelect(file: File) {
    const resolvedMediaType = resolveAccountMediaType(file)
    if (!resolvedMediaType) {
      toast.error('Unsupported file type.', {
        description: 'Upload JPG, PNG, WEBP, PDF, Word, Excel, CSV, PowerPoint, TXT, or RTF files.',
      })
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File too large', { description: 'Maximum 10MB.' })
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('folder', 'account-media')
      formData.append('filename', `account-media-${accountId}-${file.name}`)

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(payload?.error || 'Upload failed')
      }

      setMediaUrl(payload.publicUrl)
      setMediaType(resolvedMediaType)
      setFileName(file.name)
      toast.success('File uploaded')
    } catch (error) {
      toast.error('Upload failed', { description: error instanceof Error ? error.message : undefined })
    } finally {
      setUploading(false)
    }
  }

  function handleDragOver(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    if (!uploading && !isPending) {
      setIsDragging(true)
    }
  }

  function handleDragLeave(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    const relatedTarget = event.relatedTarget as Node | null
    if (!relatedTarget || !event.currentTarget.contains(relatedTarget)) {
      setIsDragging(false)
    }
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    setIsDragging(false)
    if (uploading || isPending) return

    const file = event.dataTransfer.files?.[0]
    if (file) {
      void handleFileSelect(file)
    }
  }

  function resetUploadState() {
    setMediaUrl('')
    setMediaType(null)
    setFileName('')
  }

  function handleSave() {
    if (!mediaUrl || !mediaType) {
      toast.error('Upload a file first.')
      return
    }

    startTransition(async () => {
      const formData = new FormData()
      formData.append('accountId', accountId)
      formData.append('mediaUrl', mediaUrl)
      formData.append('mediaType', mediaType)
      formData.append('category', category)
      formData.append('taggedDate', taggedDate)
      formData.append('caption', caption)

      const result = await addAccountMedia(formData)
      if (result?.error) {
        toast.error('Failed to save media', { description: result.error })
        return
      }

      toast.success('Account media saved')
      resetUploadState()
      setCaption('')
      setCategory('store_visit')
      setTaggedDate(todayValue())
      router.refresh()
    })
  }

  const previewMeta = mediaType ? getPreviewMeta(mediaType) : null
  const PreviewIcon = previewMeta?.icon ?? FileText

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <ImagePlus className="h-4 w-4" />
          Upload Account Media
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <label
            className="block cursor-pointer"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <span
              className={`flex min-h-40 flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-4 text-center transition-colors ${
                isDragging
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-slate-300 bg-slate-50 hover:border-blue-400 hover:bg-blue-50'
              }`}
            >
              {uploading ? <Loader2 className="mb-2 h-6 w-6 animate-spin text-slate-500" /> : <ImagePlus className="mb-2 h-6 w-6 text-slate-500" />}
              <span className="text-sm font-semibold text-slate-900">
                {mediaUrl ? 'Replace uploaded file' : 'Upload image or document'}
              </span>
              <span className="mt-1 text-xs text-slate-500">
                {isDragging ? 'Drop file here' : 'Drag and drop or click to upload'}
              </span>
              <span className="mt-1 text-xs text-slate-400">Images, PDFs, Word, Excel, CSV, PowerPoint, TXT, or RTF up to 10MB</span>
            </span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf,.pdf,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.txt,.rtf"
              className="hidden"
              disabled={uploading || isPending}
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void handleFileSelect(file)
                event.currentTarget.value = ''
              }}
            />
          </label>

          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor={`account-media-category-${accountId}`}>Category</Label>
              <select
                id={`account-media-category-${accountId}`}
                value={category}
                disabled={uploading || isPending}
                onChange={(event) => setCategory(event.target.value as typeof category)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {ACCOUNT_MEDIA_CATEGORY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor={`account-media-date-${accountId}`}>Tagged Date</Label>
              <Input
                id={`account-media-date-${accountId}`}
                type="date"
                value={taggedDate}
                disabled={uploading || isPending}
                onChange={(event) => setTaggedDate(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`account-media-caption-${accountId}`}>Caption</Label>
              <Input
                id={`account-media-caption-${accountId}`}
                value={caption}
                disabled={uploading || isPending}
                onChange={(event) => setCaption(event.target.value)}
                placeholder="Optional note about the file"
              />
            </div>
          </div>
        </div>

        {mediaUrl ? (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
            {mediaType === 'image' ? (
              <div className="aspect-[4/3] max-w-sm bg-slate-100">
                <img src={mediaUrl} alt="Uploaded account media preview" className="h-full w-full object-cover" />
              </div>
            ) : (
              <div className="flex items-center gap-4 px-5 py-5">
                <PreviewIcon className="h-8 w-8 text-slate-500" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{fileName || 'Uploaded file'}</p>
                  <p className="text-xs text-slate-500">{previewMeta?.label ?? 'Document file'}</p>
                </div>
                <a href={mediaUrl} target="_blank" rel="noreferrer" className="ml-auto text-sm font-medium text-blue-600 underline">
                  Open
                </a>
              </div>
            )}
          </div>
        ) : null}

        <div className="flex justify-end">
          <Button type="button" disabled={uploading || isPending || !mediaUrl || !mediaType || !taggedDate} onClick={handleSave}>
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save Media
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
