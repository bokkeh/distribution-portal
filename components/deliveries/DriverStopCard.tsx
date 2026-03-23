'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { completeDeliveryStop, updateStopStatus } from '@/actions/deliveries'
import { getDeliveryStopAdditionalPhotos } from '@/lib/deliveries/photos'
import { signedPhotoUrl } from '@/lib/gcs/photo-url'
import { BottleWine, Camera, CheckCircle, Loader2, PackageCheck, XCircle } from 'lucide-react'

type Stop = {
  id: string
  status: 'pending' | 'delivered' | 'failed'
  notes: string | null
  proofOfDeliveryUrl?: string | null
  shelfPhotoUrl?: string | null
  additionalPhotoUrl?: string | null
  additionalPhotoUrl2?: string | null
  additionalPhotoUrl3?: string | null
  additionalPhotoUrl4?: string | null
  additionalPhotoUrl5?: string | null
}

export function DriverStopActions({ stop }: { stop: Stop }) {
  const [isPending, startTransition] = useTransition()
  const [notes, setNotes] = useState(stop.notes ?? '')
  const [proofOfDeliveryUrl, setProofOfDeliveryUrl] = useState(stop.proofOfDeliveryUrl ?? '')
  const [shelfPhotoUrl, setShelfPhotoUrl] = useState(stop.shelfPhotoUrl ?? '')
  const [additionalPhotoUrls, setAdditionalPhotoUrls] = useState<string[]>(
    Array.from({ length: 5 }, (_, index) => getDeliveryStopAdditionalPhotos(stop)[index] ?? ''),
  )
  const [uploadingProof, setUploadingProof] = useState(false)
  const [uploadingShelf, setUploadingShelf] = useState(false)
  const [uploadingAdditional, setUploadingAdditional] = useState<boolean[]>([false, false, false, false, false])

  async function handleUpload(file: File, kind: 'proof' | 'shelf' | 'additional', additionalIndex = 0) {
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File too large', { description: 'Maximum 10MB.' })
      return
    }

    if (kind === 'proof') setUploadingProof(true)
    else if (kind === 'shelf') setUploadingShelf(true)
    else setUploadingAdditional(prev => prev.map((item, index) => index === additionalIndex ? true : item))

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('folder', 'deliveries')
      formData.append('filename', `${kind}-${file.name}`)

      const response = await fetch('/api/upload', { method: 'POST', body: formData })
      const payload = await response.json().catch(() => null)

      if (!response.ok) throw new Error(payload?.error || 'Upload failed')

      if (kind === 'proof') setProofOfDeliveryUrl(payload.publicUrl)
      else if (kind === 'shelf') setShelfPhotoUrl(payload.publicUrl)
      else setAdditionalPhotoUrls(prev => prev.map((item, index) => index === additionalIndex ? payload.publicUrl : item))

      toast.success(kind === 'proof' ? 'Proof photo uploaded' : kind === 'shelf' ? 'Shelf photo uploaded' : `Additional photo ${additionalIndex + 1} uploaded`)
    } catch (error) {
      toast.error('Upload failed', { description: error instanceof Error ? error.message : undefined })
    } finally {
      if (kind === 'proof') setUploadingProof(false)
      else if (kind === 'shelf') setUploadingShelf(false)
      else setUploadingAdditional(prev => prev.map((item, index) => index === additionalIndex ? false : item))
    }
  }

  function handleDelivered() {
    startTransition(async () => {
      try {
        const formData = new FormData()
        formData.append('notes', notes)
        formData.append('proofOfDeliveryUrl', proofOfDeliveryUrl)
        formData.append('shelfPhotoUrl', shelfPhotoUrl)
        additionalPhotoUrls.forEach((url, index) => {
          formData.append(`additionalPhotoUrl${index + 1}`, url)
        })
        await completeDeliveryStop(stop.id, formData)
        toast.success('Stop marked delivered')
      } catch (error) {
        toast.error('Unable to complete stop', { description: error instanceof Error ? error.message : undefined })
      }
    })
  }

  function handleFailed() {
    startTransition(async () => {
      try {
        await updateStopStatus(stop.id, 'failed')
        toast.success('Stop marked failed')
      } catch (error) {
        toast.error('Unable to update stop', { description: error instanceof Error ? error.message : undefined })
      }
    })
  }

  if (stop.status !== 'pending') {
    const savedAdditionalPhotos = additionalPhotoUrls.filter(Boolean)
    return (
      <div className="space-y-1">
        {proofOfDeliveryUrl && <a href={signedPhotoUrl(proofOfDeliveryUrl) ?? proofOfDeliveryUrl} target="_blank" rel="noreferrer" className="block text-xs text-blue-600 underline">View proof of delivery</a>}
        {shelfPhotoUrl && <a href={signedPhotoUrl(shelfPhotoUrl) ?? shelfPhotoUrl} target="_blank" rel="noreferrer" className="block text-xs text-blue-600 underline">View shelf photo</a>}
        {savedAdditionalPhotos.map((url, index) => (
          <a key={url} href={signedPhotoUrl(url) ?? url} target="_blank" rel="noreferrer" className="block text-xs text-blue-600 underline">
            View additional photo {index + 1}
          </a>
        ))}
      </div>
    )
  }

  const tiles: { kind: 'proof' | 'shelf'; label: string; url: string; uploading: boolean; icon: React.ReactNode; hint: string }[] = [
    { kind: 'proof',      label: 'Proof of Delivery', url: proofOfDeliveryUrl, uploading: uploadingProof,      icon: <PackageCheck className="mb-2 h-6 w-6" />, hint: 'Drop-off confirmation' },
    { kind: 'shelf',      label: 'Shelf Photo',        url: shelfPhotoUrl,      uploading: uploadingShelf,      icon: <BottleWine className="mb-2 h-6 w-6" />,   hint: 'Shelf after stocking' },
  ]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {tiles.map(({ kind, label, url, uploading, icon, hint }) => (
          <label key={kind} className="block cursor-pointer">
            <span className="mb-1 block truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
            <span className="flex min-h-[100px] w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-2 py-3 text-center text-slate-600 transition-colors active:bg-blue-50 hover:border-blue-400 hover:bg-blue-50">
              {uploading ? <Loader2 className="mb-2 h-7 w-7 animate-spin" /> : icon}
              <span className="text-xs font-semibold leading-tight text-slate-900">
                {url ? 'Replace' : 'Upload'}
              </span>
              <span className="mt-1 text-[10px] leading-tight text-muted-foreground">{hint}</span>
              {url && (
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  onClick={e => e.stopPropagation()}
                  className="mt-2 text-[10px] font-medium text-blue-600 underline"
                >
                  Preview
                </a>
              )}
            </span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              className="hidden"
              onChange={event => {
                const file = event.target.files?.[0]
                if (file) void handleUpload(file, kind)
              }}
            />
          </label>
        ))}
        {additionalPhotoUrls.map((url, index) => (
          <label key={`additional-${index}`} className="block cursor-pointer">
            <span className="mb-1 block truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Extra Photo {index + 1}
            </span>
            <span className="flex min-h-[100px] w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-2 py-3 text-center text-slate-600 transition-colors active:bg-blue-50 hover:border-blue-400 hover:bg-blue-50">
              {uploadingAdditional[index] ? <Loader2 className="mb-2 h-7 w-7 animate-spin" /> : <Camera className="mb-2 h-7 w-7" />}
              <span className="text-xs font-semibold leading-tight text-slate-900">
                {url ? 'Replace' : 'Upload'}
              </span>
              <span className="mt-1 text-[10px] leading-tight text-muted-foreground">Additional photo</span>
              {url && (
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  onClick={e => e.stopPropagation()}
                  className="mt-2 text-[10px] font-medium text-blue-600 underline"
                >
                  Preview
                </a>
              )}
            </span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              className="hidden"
              onChange={event => {
                const file = event.target.files?.[0]
                if (file) void handleUpload(file, 'additional', index)
              }}
            />
          </label>
        ))}
      </div>

      <div className="space-y-2">
        <label htmlFor={`notes-${stop.id}`} className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Driver Notes</label>
        <textarea
          id={`notes-${stop.id}`}
          value={notes}
          onChange={event => setNotes(event.target.value)}
          placeholder="Add delivery updates, owner requests, or shelf notes."
          className="min-h-24 w-full rounded-xl border border-input bg-white px-3 py-2.5 text-base shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={handleDelivered}
          disabled={isPending || uploadingProof || uploadingShelf || uploadingAdditional.some(Boolean)}
          className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-green-600 text-base font-semibold text-white shadow-sm active:scale-[0.98] transition-transform disabled:opacity-50"
        >
          {isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle className="h-5 w-5" />}
          Delivered
        </button>
        <ConfirmDialog
          trigger={
            <button
              type="button"
              disabled={isPending}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-red-50 border border-red-200 text-base font-semibold text-red-600 shadow-sm active:scale-[0.98] transition-transform disabled:opacity-50"
            >
              <XCircle className="h-5 w-5" />
              Failed
            </button>
          }
          title="Mark stop as failed?"
          description="This will flag the stop and notify the dispatch team."
          confirmLabel="Mark Failed"
          variant="destructive"
          onConfirm={handleFailed}
        />
      </div>
    </div>
  )
}
