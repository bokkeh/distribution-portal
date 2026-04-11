'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ImagePlus, Loader2 } from 'lucide-react'
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

function todayValue() {
  return new Date().toISOString().slice(0, 10)
}

export function AccountMediaUploadCard({ accountId }: { accountId: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [uploading, setUploading] = useState(false)
  const [mediaUrl, setMediaUrl] = useState('')
  const [caption, setCaption] = useState('')
  const [category, setCategory] = useState<(typeof ACCOUNT_MEDIA_CATEGORY_OPTIONS)[number]['value']>('store_visit')
  const [taggedDate, setTaggedDate] = useState(todayValue())

  async function handleFileSelect(file: File) {
    if (!file.type.startsWith('image/')) {
      toast.error('Only image uploads are supported right now.')
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
      toast.success('Media uploaded')
    } catch (error) {
      toast.error('Upload failed', { description: error instanceof Error ? error.message : undefined })
    } finally {
      setUploading(false)
    }
  }

  function handleSave() {
    if (!mediaUrl) {
      toast.error('Upload an image first.')
      return
    }

    startTransition(async () => {
      const formData = new FormData()
      formData.append('accountId', accountId)
      formData.append('mediaUrl', mediaUrl)
      formData.append('mediaType', 'image')
      formData.append('category', category)
      formData.append('taggedDate', taggedDate)
      formData.append('caption', caption)

      const result = await addAccountMedia(formData)
      if (result?.error) {
        toast.error('Failed to save media', { description: result.error })
        return
      }

      toast.success('Account media saved')
      setMediaUrl('')
      setCaption('')
      setCategory('store_visit')
      setTaggedDate(todayValue())
      router.refresh()
    })
  }

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
          <label className="block cursor-pointer">
            <span className="flex min-h-40 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-center transition-colors hover:border-blue-400 hover:bg-blue-50">
              {uploading ? <Loader2 className="mb-2 h-6 w-6 animate-spin text-slate-500" /> : <ImagePlus className="mb-2 h-6 w-6 text-slate-500" />}
              <span className="text-sm font-semibold text-slate-900">
                {mediaUrl ? 'Replace uploaded image' : 'Upload image'}
              </span>
              <span className="mt-1 text-xs text-slate-500">JPG, PNG, or WEBP up to 10MB</span>
            </span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              disabled={uploading || isPending}
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void handleFileSelect(file)
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
                placeholder="Optional note about the image"
              />
            </div>
          </div>
        </div>

        {mediaUrl ? (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
            <div className="aspect-[4/3] max-w-sm bg-slate-100">
              <img src={mediaUrl} alt="Uploaded account media preview" className="h-full w-full object-cover" />
            </div>
          </div>
        ) : null}

        <div className="flex justify-end">
          <Button type="button" disabled={uploading || isPending || !mediaUrl || !taggedDate} onClick={handleSave}>
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save Media
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
