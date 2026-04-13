'use client'

import { useId, useRef, useState } from 'react'
import Image from 'next/image'
import { ImageIcon, Loader2, Upload, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

export function PromotionCatalogImageField({
  name = 'imageUrl',
  value = '',
  disabled,
}: {
  name?: string
  value?: string
  disabled?: boolean
}) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [imageUrl, setImageUrl] = useState(value)

  async function handleUpload(file: File) {
    if (file.size > 8 * 1024 * 1024) {
      toast.error('File too large', { description: 'Maximum 8MB for promotion catalog images.' })
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('folder', 'promotion-catalog')
      formData.append('filename', file.name)

      const response = await fetch('/api/upload', { method: 'POST', body: formData })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error || 'Upload failed')

      setImageUrl(payload.publicUrl)
      toast.success('Catalog image uploaded')
    } catch (error) {
      toast.error('Upload failed', { description: error instanceof Error ? error.message : undefined })
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-3">
      <input type="hidden" name={name} value={imageUrl} />
      <div className="overflow-hidden rounded-xl border bg-slate-50">
        <div className="relative aspect-[4/3] w-full bg-slate-100">
          {imageUrl ? (
            <Image src={imageUrl} alt="Promotion image" fill className="object-cover" unoptimized />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-slate-400">
              <ImageIcon className="h-10 w-10" />
            </div>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          disabled={disabled || uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {imageUrl ? 'Replace Image' : 'Upload Image'}
        </Button>
        {imageUrl ? (
          <Button type="button" variant="ghost" disabled={disabled || uploading} onClick={() => setImageUrl('')}>
            <X className="mr-2 h-4 w-4" />
            Remove
          </Button>
        ) : null}
      </div>
      <input
        id={inputId}
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        disabled={disabled || uploading}
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void handleUpload(file)
          event.currentTarget.value = ''
        }}
      />
    </div>
  )
}
