'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { completeDeliveryStop, getDeliveryStopUploadUrl, updateStopStatus } from '@/actions/deliveries'
import { CheckCircle, Loader2, UploadCloud, XCircle } from 'lucide-react'

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
    <div className="space-y-3">
      <div className="space-y-2">
        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Proof of Delivery</label>
        <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-600 hover:border-blue-400 hover:bg-slate-50">
          {uploadingProof ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
          <span>{proofOfDeliveryUrl ? 'Replace proof photo' : 'Upload proof photo'}</span>
          <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" onChange={event => {
            const file = event.target.files?.[0]
            if (file) void handleUpload(file, 'proof')
          }} />
        </label>
        {proofOfDeliveryUrl && <a href={proofOfDeliveryUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline">Preview proof photo</a>}
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Shelf Photo</label>
        <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-600 hover:border-blue-400 hover:bg-slate-50">
          {uploadingShelf ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
          <span>{shelfPhotoUrl ? 'Replace shelf photo' : 'Upload shelf photo'}</span>
          <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" onChange={event => {
            const file = event.target.files?.[0]
            if (file) void handleUpload(file, 'shelf')
          }} />
        </label>
        {shelfPhotoUrl && <a href={shelfPhotoUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline">Preview shelf photo</a>}
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
        <Button type="button" onClick={handleDelivered} disabled={isPending || uploadingProof || uploadingShelf} className="gap-2">
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
          Mark Delivered
        </Button>
        <Button type="button" variant="outline" onClick={handleFailed} disabled={isPending}>
          <XCircle className="mr-2 h-4 w-4" />
          Mark Failed
        </Button>
      </div>
    </div>
  )
}
