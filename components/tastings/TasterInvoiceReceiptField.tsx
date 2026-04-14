'use client'

import { useId, useRef, useState } from 'react'
import { FileText, Loader2, Upload, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

type ReceiptItem = {
  url: string
  label: string
}

export function TasterInvoiceReceiptField({
  name = 'receiptUrls',
  value = [],
  disabled,
}: {
  name?: string
  value?: string[]
  disabled?: boolean
}) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [receipts, setReceipts] = useState<ReceiptItem[]>(
    value.filter(Boolean).map((url) => ({
      url,
      label: decodeURIComponent(url.split('%2F').pop()?.split('?')[0] ?? url.split('/').pop() ?? 'Uploaded receipt'),
    })),
  )

  async function handleUpload(file: File) {
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File too large', { description: 'Maximum 10MB per receipt.' })
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('folder', 'documents')
      formData.append('filename', `taster-invoice-receipt-${file.name}`)

      const response = await fetch('/api/upload', { method: 'POST', body: formData })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error || 'Upload failed')

      setReceipts((current) => [...current, { url: payload.publicUrl, label: file.name }])
      toast.success('Receipt uploaded')
    } catch (error) {
      toast.error('Upload failed', { description: error instanceof Error ? error.message : undefined })
    } finally {
      setUploading(false)
    }
  }

  function removeReceipt(url: string) {
    setReceipts((current) => current.filter((item) => item.url !== url))
  }

  return (
    <div className="space-y-3">
      {receipts.map((receipt) => (
        <input key={receipt.url} type="hidden" name={name} value={receipt.url} />
      ))}

      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-900">Receipts</p>
            <p className="text-xs text-slate-500">Upload receipts for mileage, parking, supplies, or other reimbursable expenses.</p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            disabled={disabled || uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Add Receipt
          </Button>
        </div>

        {receipts.length ? (
          <div className="mt-4 space-y-2">
            {receipts.map((receipt) => (
              <div key={receipt.url} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
                <a href={receipt.url} target="_blank" rel="noreferrer" className="inline-flex min-w-0 items-center gap-2 text-sm font-medium text-blue-600 underline">
                  <FileText className="h-4 w-4 shrink-0" />
                  <span className="truncate">{receipt.label}</span>
                </a>
                <Button type="button" variant="ghost" size="sm" disabled={disabled || uploading} onClick={() => removeReceipt(receipt.url)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-500">No receipts uploaded yet.</p>
        )}
      </div>

      <input
        id={inputId}
        ref={inputRef}
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp"
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
