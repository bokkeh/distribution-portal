'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { completeDeliveryStop, getDeliveryStopUploadUrl, updateStopStatus } from '@/actions/deliveries'
import { BottleWine, CheckCircle, Loader2, PackageCheck, XCircle } from 'lucide-react'

type Stop = {
  id: string
  status: 'pending' | 'delivered' | 'failed'
  notes: string | null
  proofOfDeliveryUrl?: string | null
  shelfPhotoUrl?: string | null
}

export function DriverStopActions({ stop }: { stop: Stop }) {
  const [isPending, startTransition] = useTransition()
  const [notes, setNotes] = useState(stop.notes ?? '')
  const [proofOfDeliveryUrl, setProofOfDeliveryUrl] = useState(stop.proofOfDeliveryUrl ?? '')
  const [shelfPhotoUrl, setShelfPhotoUrl] = useState(stop.shelfPhotoUrl ?? '')
  const [uploadingProof, setUploadingProof] = useState(false)
  const [uploadingShelf, setUploadingShelf] = useState(false)

  async function handleUpload(file: File, kind: 'proof' | 'shelf') {
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File too large', { description: 'Maximum 10MB.' })
      return
    }

    const setUploading = kind === 'proof' ? setUploadingProof : setUploadingShelf
    const setUrl = kind === 'proof' ? setProofOfDeliveryUrl : setShelfPhotoUrl

    setUploading(true)
    try {
      const { uploadUrl, publicUrl, error } = await getDeliveryStopUploadUrl(kind, file.type)
      if (error) throw new Error(error)

      const response = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      })

      if (!response.ok) throw new Error('Upload failed')

      setUrl(publicUrl)
      toast.success(kind === 'proof' ? 'Proof photo uploaded' : 'Shelf photo uploaded')
    } catch (error) {
      toast.error('Upload failed', { description: error instanceof Error ? error.message : undefined })
    } finally {
      setUploading(false)
    }
  }

  function handleDelivered() {
    startTransition(async () => {
      try {
        const formData = new FormData()
        formData.append('notes', notes)
        formData.append('proofOfDeliveryUrl', proofOfDeliveryUrl)
        formData.append('shelfPhotoUrl', shelfPhotoUrl)
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
    return (
      <div className="space-y-3">
        {proofOfDeliveryUrl && <a href={proofOfDeliveryUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline">View proof of delivery</a>}
        {shelfPhotoUrl && <a href={shelfPhotoUrl} target="_blank" rel="noreferrer" className="block text-xs text-blue-600 underline">View shelf photo</a>}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block cursor-pointer">
          <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Proof Of Delivery</span>
          <span className="flex aspect-square w-full max-w-[9rem] flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-center text-slate-600 transition-colors hover:border-blue-400 hover:bg-blue-50">
            {uploadingProof ? <Loader2 className="mb-3 h-7 w-7 animate-spin" /> : <PackageCheck className="mb-3 h-7 w-7" />}
            <span className="text-sm font-semibold text-slate-900">
              {proofOfDeliveryUrl ? 'Replace Delivery Photo' : 'Upload Delivery Photo'}
            </span>
            <span className="mt-2 text-xs text-muted-foreground">
              Driver proof at drop-off
            </span>
            {proofOfDeliveryUrl && (
              <a
                href={proofOfDeliveryUrl}
                target="_blank"
                rel="noreferrer"
                onClick={event => event.stopPropagation()}
                className="mt-3 text-xs font-medium text-blue-600 underline"
              >
                Preview current image
              </a>
            )}
          </span>
          <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" onChange={event => {
            const file = event.target.files?.[0]
            if (file) void handleUpload(file, 'proof')
          }} />
        </label>

        <label className="block cursor-pointer">
          <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Shelf Photo</span>
          <span className="flex aspect-square w-full max-w-[9rem] flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-center text-slate-600 transition-colors hover:border-blue-400 hover:bg-blue-50">
            {uploadingShelf ? <Loader2 className="mb-3 h-7 w-7 animate-spin" /> : <BottleWine className="mb-3 h-7 w-7" />}
            <span className="text-sm font-semibold text-slate-900">
              {shelfPhotoUrl ? 'Replace Shelf Photo' : 'Upload Shelf Photo'}
            </span>
            <span className="mt-2 text-xs text-muted-foreground">
              Shelf condition after delivery
            </span>
            {shelfPhotoUrl && (
              <a
                href={shelfPhotoUrl}
                target="_blank"
                rel="noreferrer"
                onClick={event => event.stopPropagation()}
                className="mt-3 text-xs font-medium text-blue-600 underline"
              >
                Preview current image
              </a>
            )}
          </span>
          <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" onChange={event => {
            const file = event.target.files?.[0]
            if (file) void handleUpload(file, 'shelf')
          }} />
        </label>
      </div>

      <div className="space-y-2">
        <label htmlFor={`notes-${stop.id}`} className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Driver Notes</label>
        <textarea
          id={`notes-${stop.id}`}
          value={notes}
          onChange={event => setNotes(event.target.value)}
          placeholder="Add delivery updates, owner requests, or shelf notes."
          className="min-h-24 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>

      <div className="flex gap-2">
        <Button
          type="button"
          onClick={handleDelivered}
          disabled={isPending || uploadingProof || uploadingShelf}
          className="gap-2 bg-green-600 text-white hover:bg-green-700"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
          Mark Delivered
        </Button>
        <Button
          type="button"
          variant="destructive"
          onClick={handleFailed}
          disabled={isPending}
        >
          <XCircle className="mr-2 h-4 w-4" />
          Mark Failed
        </Button>
      </div>
    </div>
  )
}
