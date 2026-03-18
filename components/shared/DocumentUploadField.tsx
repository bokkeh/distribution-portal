'use client'

import { useState } from 'react'
import { Loader2, Upload, FileText } from 'lucide-react'
import { toast } from 'sonner'

export function DocumentUploadField({
  name,
  value,
  onChange,
  label,
}: {
  name: string
  value: string
  onChange: (value: string) => void
  label?: string
}) {
  const [uploading, setUploading] = useState(false)

  async function handleFileSelect(file: File) {
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File too large', { description: 'Maximum 10MB.' })
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('folder', 'documents')
      formData.append('filename', `${name}-${file.name}`)

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(payload?.error || 'Upload failed')
      }

      onChange(payload.publicUrl)
      toast.success('Document uploaded')
    } catch (error) {
      toast.error('Upload failed', { description: error instanceof Error ? error.message : undefined })
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-2">
      <input type="hidden" name={name} value={value} />
      <label className="block cursor-pointer">
        <span className="flex min-h-28 flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-center transition-colors hover:border-blue-400 hover:bg-blue-50">
          {uploading ? <Loader2 className="mb-2 h-6 w-6 animate-spin text-slate-500" /> : <Upload className="mb-2 h-6 w-6 text-slate-500" />}
          <span className="text-sm font-semibold text-slate-900">
            {label ?? 'Upload document'}
          </span>
          <span className="mt-1 text-xs text-muted-foreground">
            PDF, JPG, PNG, or WEBP up to 10MB
          </span>
        </span>
        <input
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void handleFileSelect(file)
          }}
        />
      </label>
      {value && (
        <a href={value} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 underline">
          <FileText className="h-4 w-4" />
          View uploaded document
        </a>
      )}
    </div>
  )
}
