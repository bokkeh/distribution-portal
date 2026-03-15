'use client'

import { useId, useRef, useState } from 'react'
import Image from 'next/image'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Camera, Loader2, UserCircle2 } from 'lucide-react'

type ProfilePhotoUploadFieldProps = {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

export function ProfilePhotoUploadField({ value, onChange, disabled }: ProfilePhotoUploadFieldProps) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  async function handleUpload(file: File) {
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File too large', { description: 'Maximum 10MB.' })
      return
    }

    setUploading(true)
    try {
      // Step 1: get a signed upload URL from the server
      const signRes = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, contentType: file.type, folder: 'avatars' }),
      })
      const signPayload = await signRes.json().catch(() => null)
      if (!signRes.ok) throw new Error(signPayload?.error || 'Could not get upload URL')

      // Step 2: PUT the file directly to GCS (bypasses serverless size limits)
      const putRes = await fetch(signPayload.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      })
      if (!putRes.ok) throw new Error(`Storage upload failed (${putRes.status})`)

      onChange(signPayload.publicUrl)
      toast.success('Profile photo uploaded')
    } catch (error) {
      toast.error('Upload failed', { description: error instanceof Error ? error.message : undefined })
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-slate-50/70 p-4 sm:flex-row sm:items-center">
      <div className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-white">
        {value ? (
          <Image src={value} alt="Profile photo" fill className="object-cover" />
        ) : (
          <UserCircle2 className="h-12 w-12 text-slate-300" />
        )}
      </div>

      <div className="space-y-2">
        <div>
          <p className="text-sm font-medium text-slate-900">Profile Photo</p>
          <p className="text-xs text-muted-foreground">Upload a headshot or logo to represent this account across the platform.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            disabled={disabled || uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            {value ? 'Replace Photo' : 'Upload Photo'}
          </Button>
          {value && (
            <Button type="button" variant="ghost" disabled={disabled || uploading} onClick={() => onChange('')}>
              Remove
            </Button>
          )}
        </div>

        <input
          id={inputId}
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          disabled={disabled || uploading}
          onChange={event => {
            const file = event.target.files?.[0]
            if (file) void handleUpload(file)
            event.currentTarget.value = ''
          }}
        />
      </div>
    </div>
  )
}
