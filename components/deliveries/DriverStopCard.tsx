'use client'

import { type ReactNode, useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { completeDeliveryStop, markDeliveryStopArrived, markDeliveryStopFailed, saveRecipientSignature, startDeliveryForStop, updateDeliveryStopMedia } from '@/actions/deliveries'
import { getDeliveryStopAdditionalPhotos } from '@/lib/deliveries/photos'
import { signedPhotoUrl } from '@/lib/gcs/photo-url'
import { BottleWine, Camera, CheckCircle, Loader2, MapPinned, Navigation, PackageCheck, PenSquare, Save, Timer, XCircle } from 'lucide-react'
import { SignaturePad } from '@/components/deliveries/SignaturePad'
import { DriverLocationTracker, type DriverGpsState } from '@/components/deliveries/DriverLocationTracker'

type Stop = {
  id: string
  status: 'pending' | 'delivered' | 'failed'
  customerStatus?: 'not_started' | 'out_for_delivery' | 'arriving_soon' | 'arrived' | 'delivered' | 'failed'
  notes: string | null
  proofOfDeliveryUrl?: string | null
  shelfPhotoUrl?: string | null
  additionalPhotoUrl?: string | null
  additionalPhotoUrl2?: string | null
  additionalPhotoUrl3?: string | null
  additionalPhotoUrl4?: string | null
  additionalPhotoUrl5?: string | null
  trackingEnabled?: boolean
  trackingToken?: string | null
  etaMinutes?: number | null
  lastLocationAt?: Date | null
  recipientSignatureUrl?: string | null
  recipientSignedName?: string | null
  lat?: string | null
  lng?: string | null
}

function formatRelativeMinutes(timestamp: number | Date | null | undefined) {
  if (!timestamp) return null
  const value = timestamp instanceof Date ? timestamp.getTime() : timestamp
  const diffMs = Date.now() - value
  if (diffMs < 60_000) return 'just now'
  const minutes = Math.max(1, Math.round(diffMs / 60_000))
  return `${minutes}m ago`
}

export function DriverStopActions({
  stop,
  routeHasActiveStop = false,
  onCompleted,
}: {
  stop: Stop
  routeHasActiveStop?: boolean
  onCompleted?: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [notes, setNotes] = useState(stop.notes ?? '')
  const [proofOfDeliveryUrl, setProofOfDeliveryUrl] = useState(stop.proofOfDeliveryUrl ?? '')
  const [shelfPhotoUrl, setShelfPhotoUrl] = useState(stop.shelfPhotoUrl ?? '')
  const [additionalPhotoUrls, setAdditionalPhotoUrls] = useState<string[]>(
    Array.from({ length: 5 }, (_, index) => getDeliveryStopAdditionalPhotos(stop)[index] ?? ''),
  )
  const [recipientSignatureUrl, setRecipientSignatureUrl] = useState(stop.recipientSignatureUrl ?? '')
  const [recipientSignedName, setRecipientSignedName] = useState(stop.recipientSignedName ?? '')
  const [uploadingProof, setUploadingProof] = useState(false)
  const [uploadingShelf, setUploadingShelf] = useState(false)
  const [uploadingAdditional, setUploadingAdditional] = useState<boolean[]>([false, false, false, false, false])
  const [uploadingSignature, setUploadingSignature] = useState(false)
  const [signatureSaved, setSignatureSaved] = useState(!!stop.recipientSignatureUrl && !stop.recipientSignatureUrl.startsWith('data:'))
  const [customerStatus, setCustomerStatus] = useState(stop.customerStatus ?? 'not_started')
  const trackingActive = stop.status === 'pending' && ['out_for_delivery', 'arriving_soon', 'arrived'].includes(customerStatus)
  const [gpsState, setGpsState] = useState<DriverGpsState>({
    status: trackingActive ? 'sharing' : 'inactive',
    lastSentAt: stop.lastLocationAt ? new Date(stop.lastLocationAt).getTime() : null,
  })
  const hasAnotherActiveStop = routeHasActiveStop && !trackingActive
  const lastLocationAge = formatRelativeMinutes(gpsState.lastSentAt)
  const staleLocation = gpsState.lastSentAt ? Date.now() - gpsState.lastSentAt > 5 * 60_000 : false

  async function handleUpload(file: File, kind: 'proof' | 'shelf' | 'additional', additionalIndex = 0) {
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File too large', { description: 'Maximum 10MB.' })
      return
    }

    if (kind === 'proof') setUploadingProof(true)
    else if (kind === 'shelf') setUploadingShelf(true)
    else setUploadingAdditional((prev) => prev.map((item, index) => index === additionalIndex ? true : item))

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
      else setAdditionalPhotoUrls((prev) => prev.map((item, index) => index === additionalIndex ? payload.publicUrl : item))

      toast.success(kind === 'proof' ? 'Proof photo uploaded' : kind === 'shelf' ? 'Shelf photo uploaded' : `Additional photo ${additionalIndex + 1} uploaded`)
    } catch (error) {
      toast.error('Upload failed', { description: error instanceof Error ? error.message : undefined })
    } finally {
      if (kind === 'proof') setUploadingProof(false)
      else if (kind === 'shelf') setUploadingShelf(false)
      else setUploadingAdditional((prev) => prev.map((item, index) => index === additionalIndex ? false : item))
    }
  }

  async function handleSaveSignature() {
    if (!recipientSignatureUrl) return
    setUploadingSignature(true)
    try {
      let uploadedUrl = recipientSignatureUrl
      if (uploadedUrl.startsWith('data:image/')) {
        uploadedUrl = await uploadSignatureDataUrl(uploadedUrl)
        setRecipientSignatureUrl(uploadedUrl)
      }
      await saveRecipientSignature(stop.id, uploadedUrl)
      setSignatureSaved(true)
      toast.success('Signature saved', { description: `Saved at ${new Date().toLocaleTimeString()}` })
    } catch (error) {
      toast.error('Failed to save signature', { description: error instanceof Error ? error.message : undefined })
    } finally {
      setUploadingSignature(false)
    }
  }

  async function uploadSignatureDataUrl(dataUrl: string) {
    const response = await fetch(dataUrl)
    const blob = await response.blob()
    const formData = new FormData()
    formData.append('file', new File([blob], 'signature.png', { type: 'image/png' }))
    formData.append('folder', 'deliveries')
    formData.append('filename', `signature-${stop.id}.png`)
    const uploadResponse = await fetch('/api/upload', { method: 'POST', body: formData })
    const payload = await uploadResponse.json().catch(() => null)
    if (!uploadResponse.ok) throw new Error(payload?.error || 'Signature upload failed')
    return payload.publicUrl as string
  }

  function handleStartDelivery() {
    startTransition(async () => {
      try {
        await startDeliveryForStop(stop.id)
        setCustomerStatus('out_for_delivery')
        toast.success('Delivery started and tracking link sent')
      } catch (error) {
        toast.error('Unable to start delivery', { description: error instanceof Error ? error.message : undefined })
      }
    })
  }

  function handleArrived() {
    startTransition(async () => {
      try {
        await markDeliveryStopArrived(stop.id)
        setCustomerStatus('arrived')
        toast.success('Stop marked arrived')
      } catch (error) {
        toast.error('Unable to mark arrived', { description: error instanceof Error ? error.message : undefined })
      }
    })
  }

  function handleDelivered() {
    startTransition(async () => {
      try {
        let uploadedSignatureUrl = recipientSignatureUrl
        if (uploadedSignatureUrl.startsWith('data:image/')) {
          uploadedSignatureUrl = await uploadSignatureDataUrl(uploadedSignatureUrl)
          setRecipientSignatureUrl(uploadedSignatureUrl)
        }

        const formData = new FormData()
        formData.append('notes', notes)
        formData.append('proofOfDeliveryUrl', proofOfDeliveryUrl)
        formData.append('shelfPhotoUrl', shelfPhotoUrl)
        formData.append('recipientSignatureUrl', uploadedSignatureUrl)
        formData.append('recipientSignedName', recipientSignedName)
        additionalPhotoUrls.forEach((url, index) => {
          formData.append(`additionalPhotoUrl${index + 1}`, url)
        })
        await completeDeliveryStop(stop.id, formData)
        toast.success('Stop marked delivered')
        onCompleted?.()
      } catch (error) {
        toast.error('Unable to complete stop', { description: error instanceof Error ? error.message : undefined })
      }
    })
  }

  function handleFailed() {
    startTransition(async () => {
      try {
        await markDeliveryStopFailed(stop.id)
        toast.success('Stop marked failed')
        onCompleted?.()
      } catch (error) {
        toast.error('Unable to update stop', { description: error instanceof Error ? error.message : undefined })
      }
    })
  }

  const savedAdditionalPhotos = useMemo(() => additionalPhotoUrls.filter(Boolean), [additionalPhotoUrls])
  const [editingCompleted, setEditingCompleted] = useState(false)
  const [savingMedia, setSavingMedia] = useState(false)

  if (stop.status !== 'pending') {
    if (!editingCompleted) {
      return (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {proofOfDeliveryUrl && <a href={signedPhotoUrl(proofOfDeliveryUrl) ?? proofOfDeliveryUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline">Proof of delivery</a>}
            {shelfPhotoUrl && <a href={signedPhotoUrl(shelfPhotoUrl) ?? shelfPhotoUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline">Shelf photo</a>}
            {recipientSignatureUrl && <a href={signedPhotoUrl(recipientSignatureUrl) ?? recipientSignatureUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline">Signature</a>}
            {savedAdditionalPhotos.map((url, index) => (
              <a key={url} href={signedPhotoUrl(url) ?? url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline">
                Extra photo {index + 1}
              </a>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setEditingCompleted(true)}
            className="flex items-center gap-1.5 text-xs font-medium text-slate-600 underline"
          >
            <Camera className="h-3.5 w-3.5" /> Add / edit photos & signature
          </button>
        </div>
      )
    }

    async function handleSaveMedia() {
      setSavingMedia(true)
      try {
        let sigUrl = recipientSignatureUrl
        if (sigUrl.startsWith('data:image/')) {
          sigUrl = await uploadSignatureDataUrl(sigUrl)
          setRecipientSignatureUrl(sigUrl)
        }
        const formData = new FormData()
        formData.append('proofOfDeliveryUrl', proofOfDeliveryUrl)
        formData.append('shelfPhotoUrl', shelfPhotoUrl)
        formData.append('recipientSignatureUrl', sigUrl)
        formData.append('recipientSignedName', recipientSignedName)
        formData.append('notes', notes)
        additionalPhotoUrls.forEach((url, i) => formData.append(`additionalPhotoUrl${i + 1}`, url))
        await updateDeliveryStopMedia(stop.id, formData)
        toast.success('Stop updated')
        setEditingCompleted(false)
      } catch (error) {
        toast.error('Failed to save', { description: error instanceof Error ? error.message : undefined })
      } finally {
        setSavingMedia(false)
      }
    }

    const editTiles: { kind: 'proof' | 'shelf'; label: string; url: string; uploading: boolean; icon: ReactNode; hint: string }[] = [
      { kind: 'proof', label: 'Proof of Delivery', url: proofOfDeliveryUrl, uploading: uploadingProof, icon: <PackageCheck className="mb-2 h-6 w-6" />, hint: 'Drop-off confirmation' },
      { kind: 'shelf', label: 'Shelf Photo', url: shelfPhotoUrl, uploading: uploadingShelf, icon: <BottleWine className="mb-2 h-6 w-6" />, hint: 'Shelf after stocking' },
    ]

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Edit delivery record</span>
          <button type="button" onClick={() => setEditingCompleted(false)} className="text-xs text-slate-500 underline">Cancel</button>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {editTiles.map(({ kind, label, url, uploading, icon, hint }) => (
            <label key={kind} className="block cursor-pointer">
              <span className="mb-1 block truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
              <span className="relative flex min-h-[100px] w-full overflow-hidden rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 transition-colors hover:border-blue-400">
                {uploading ? (
                  <span className="flex w-full flex-col items-center justify-center px-2 py-3"><Loader2 className="h-7 w-7 animate-spin" /></span>
                ) : url ? (
                  <>
                    <img src={url} alt={label} className="h-full w-full object-cover" style={{ minHeight: 100 }} />
                    <span className="absolute bottom-1.5 right-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white">Tap to replace</span>
                  </>
                ) : (
                  <span className="flex w-full flex-col items-center justify-center px-2 py-3 text-center text-slate-600">
                    {icon}
                    <span className="text-xs font-semibold">Upload</span>
                    <span className="mt-1 text-[10px] text-muted-foreground">{hint}</span>
                  </span>
                )}
              </span>
              <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleUpload(f, kind) }} />
            </label>
          ))}
          {additionalPhotoUrls.map((url, index) => (
            <label key={`additional-${index}`} className="block cursor-pointer">
              <span className="mb-1 block truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Extra Photo {index + 1}</span>
              <span className="relative flex min-h-[100px] w-full overflow-hidden rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 transition-colors hover:border-blue-400">
                {uploadingAdditional[index] ? (
                  <span className="flex w-full flex-col items-center justify-center px-2 py-3"><Loader2 className="h-7 w-7 animate-spin" /></span>
                ) : url ? (
                  <>
                    <img src={url} alt={`Extra ${index + 1}`} className="h-full w-full object-cover" style={{ minHeight: 100 }} />
                    <span className="absolute bottom-1.5 right-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white">Tap to replace</span>
                  </>
                ) : (
                  <span className="flex w-full flex-col items-center justify-center px-2 py-3 text-center text-slate-600">
                    <Camera className="mb-2 h-7 w-7" />
                    <span className="text-xs font-semibold">Upload</span>
                    <span className="mt-1 text-[10px] text-muted-foreground">Additional photo</span>
                  </span>
                )}
              </span>
              <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleUpload(f, 'additional', index) }} />
            </label>
          ))}
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Recipient Name</label>
          <input value={recipientSignedName} onChange={(e) => setRecipientSignedName(e.target.value)}
            placeholder="Who signed for this delivery?"
            className="flex h-11 w-full rounded-xl border border-input bg-white px-3 text-base shadow-sm" />
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <PenSquare className="h-4 w-4" /> Recipient Signature
          </div>
          <SignaturePad value={recipientSignatureUrl} onChange={(v) => { setRecipientSignatureUrl(v); setSignatureSaved(false) }} disabled={savingMedia} />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Driver Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="Add delivery updates, owner requests, or shelf notes."
            className="min-h-20 w-full rounded-xl border border-input bg-white px-3 py-2.5 text-base shadow-sm" />
        </div>

        <button
          type="button"
          onClick={handleSaveMedia}
          disabled={savingMedia || uploadingProof || uploadingShelf || uploadingAdditional.some(Boolean)}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 text-sm font-semibold text-white shadow-sm disabled:opacity-50"
        >
          {savingMedia ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Changes
        </button>
      </div>
    )
  }

  const tiles: { kind: 'proof' | 'shelf'; label: string; url: string; uploading: boolean; icon: ReactNode; hint: string }[] = [
    { kind: 'proof', label: 'Proof of Delivery', url: proofOfDeliveryUrl, uploading: uploadingProof, icon: <PackageCheck className="mb-2 h-6 w-6" />, hint: 'Drop-off confirmation' },
    { kind: 'shelf', label: 'Shelf Photo', url: shelfPhotoUrl, uploading: uploadingShelf, icon: <BottleWine className="mb-2 h-6 w-6" />, hint: 'Shelf after stocking' },
  ]

  return (
    <div className="space-y-4">
      <DriverLocationTracker stopId={stop.id} enabled={trackingActive} onStateChange={setGpsState} />

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
        <div className="flex flex-wrap items-center gap-2">
          <Navigation className="h-4 w-4 text-blue-600" />
          <span className="font-medium">Customer tracking</span>
          <span className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-600">
            {customerStatus.replace(/_/g, ' ')}
          </span>
        </div>
        <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
          <span className={`rounded-full px-2 py-1 font-medium ${
            gpsState.status === 'sharing'
              ? 'bg-emerald-100 text-emerald-700'
              : gpsState.status === 'permission_needed'
                ? 'bg-amber-100 text-amber-700'
                : gpsState.status === 'unsupported' || gpsState.status === 'error'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-slate-200 text-slate-600'
          }`}>
            {gpsState.status === 'sharing'
              ? 'GPS sharing location'
              : gpsState.status === 'permission_needed'
                ? 'GPS permission needed'
                : gpsState.status === 'unsupported'
                  ? 'GPS unsupported'
                  : gpsState.status === 'error'
                    ? 'GPS paused'
                    : 'GPS idle'}
          </span>
          {lastLocationAge ? <span className="rounded-full bg-white px-2 py-1 text-slate-600">Last ping {lastLocationAge}</span> : null}
        </div>
        {stop.etaMinutes ? <p className="mt-2 text-xs text-slate-500">Latest ETA: {stop.etaMinutes} min</p> : null}
        {staleLocation ? <p className="mt-2 text-xs font-medium text-amber-600">Live location unavailable, ETA based on the last update.</p> : null}
        {gpsState.message ? <p className="mt-2 text-xs text-slate-500">{gpsState.message}</p> : null}
        {hasAnotherActiveStop ? <p className="mt-2 text-xs font-medium text-slate-600">Another stop on this run is already active. Finish it before starting this one.</p> : null}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <button
          type="button"
          onClick={handleStartDelivery}
          disabled={isPending || trackingActive || hasAnotherActiveStop}
          className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm disabled:opacity-50"
        >
          {isPending && !trackingActive ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPinned className="h-4 w-4" />}
          Start Delivery
        </button>
        <button
          type="button"
          onClick={handleArrived}
          disabled={isPending || !trackingActive || customerStatus === 'arrived'}
          className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 text-sm font-semibold text-amber-700 disabled:opacity-50"
        >
          <Timer className="h-4 w-4" />
          Mark Arrived
        </button>
      </div>

      {customerStatus !== 'arrived' && trackingActive && (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <Timer className="h-5 w-5 shrink-0 text-amber-500" />
          <span>Tap <strong>Mark Arrived</strong> once you're on site to unlock photos, signature, and delivery confirmation.</span>
        </div>
      )}

      {customerStatus === 'arrived' && (
      <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {tiles.map(({ kind, label, url, uploading, icon, hint }) => (
          <label key={kind} className="block cursor-pointer">
            <span className="mb-1 block truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
            <span className="relative flex min-h-[100px] w-full overflow-hidden rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 transition-colors hover:border-blue-400">
              {uploading ? (
                <span className="flex w-full flex-col items-center justify-center px-2 py-3 text-slate-600">
                  <Loader2 className="mb-2 h-7 w-7 animate-spin" />
                </span>
              ) : url ? (
                <>
                  <img src={url} alt={label} className="h-full w-full object-cover" style={{ minHeight: 100 }} />
                  <span className="absolute bottom-1.5 right-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white">Tap to replace</span>
                </>
              ) : (
                <span className="flex w-full flex-col items-center justify-center px-2 py-3 text-center text-slate-600">
                  {icon}
                  <span className="text-xs font-semibold leading-tight text-slate-900">Upload</span>
                  <span className="mt-1 text-[10px] leading-tight text-muted-foreground">{hint}</span>
                </span>
              )}
            </span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void handleUpload(file, kind)
              }}
            />
          </label>
        ))}
        {additionalPhotoUrls.map((url, index) => (
          <label key={`additional-${index}`} className="block cursor-pointer">
            <span className="mb-1 block truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Extra Photo {index + 1}</span>
            <span className="relative flex min-h-[100px] w-full overflow-hidden rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 transition-colors hover:border-blue-400">
              {uploadingAdditional[index] ? (
                <span className="flex w-full flex-col items-center justify-center px-2 py-3 text-slate-600">
                  <Loader2 className="mb-2 h-7 w-7 animate-spin" />
                </span>
              ) : url ? (
                <>
                  <img src={url} alt={`Extra photo ${index + 1}`} className="h-full w-full object-cover" style={{ minHeight: 100 }} />
                  <span className="absolute bottom-1.5 right-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white">Tap to replace</span>
                </>
              ) : (
                <span className="flex w-full flex-col items-center justify-center px-2 py-3 text-center text-slate-600">
                  <Camera className="mb-2 h-7 w-7" />
                  <span className="text-xs font-semibold leading-tight text-slate-900">Upload</span>
                  <span className="mt-1 text-[10px] leading-tight text-muted-foreground">Additional photo</span>
                </span>
              )}
            </span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void handleUpload(file, 'additional', index)
              }}
            />
          </label>
        ))}
      </div>

      <div className="space-y-2">
        <label htmlFor={`signer-${stop.id}`} className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Recipient Name</label>
        <input
          id={`signer-${stop.id}`}
          value={recipientSignedName}
          onChange={(event) => setRecipientSignedName(event.target.value)}
          placeholder="Who signed for this delivery?"
          className="flex h-11 w-full rounded-xl border border-input bg-white px-3 text-base shadow-sm"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <PenSquare className="h-4 w-4" />
          Recipient Signature
        </div>
        <SignaturePad
          value={recipientSignatureUrl}
          onChange={(v) => { setRecipientSignatureUrl(v); setSignatureSaved(false) }}
          disabled={isPending}
        />
        <div className="flex items-center justify-between gap-2">
          <div className="text-[11px] text-muted-foreground">
            {signatureSaved
              ? <span className="font-medium text-green-600">Signature saved to record</span>
              : recipientSignatureUrl
                ? 'Save signature before marking delivered'
                : 'Draw signature above'}
          </div>
          <button
            type="button"
            onClick={handleSaveSignature}
            disabled={!recipientSignatureUrl || uploadingSignature || isPending || signatureSaved}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm disabled:opacity-50"
          >
            {uploadingSignature ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {signatureSaved ? 'Saved' : 'Save Signature'}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor={`notes-${stop.id}`} className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Driver Notes</label>
        <textarea
          id={`notes-${stop.id}`}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Add delivery updates, owner requests, or shelf notes."
          className="min-h-24 w-full rounded-xl border border-input bg-white px-3 py-2.5 text-base shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={handleDelivered}
          disabled={isPending || !trackingActive || !recipientSignedName.trim() || !recipientSignatureUrl || uploadingProof || uploadingShelf || uploadingAdditional.some(Boolean)}
          className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-green-600 text-base font-semibold text-white shadow-sm transition-transform disabled:opacity-50"
        >
          {isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle className="h-5 w-5" />}
          Delivered
        </button>
        <ConfirmDialog
          trigger={
            <button
              type="button"
              disabled={isPending}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 text-base font-semibold text-red-600 shadow-sm disabled:opacity-50"
            >
              <XCircle className="h-5 w-5" />
              Failed
            </button>
          }
          title="Mark stop as failed?"
          description="This will flag the stop and stop customer tracking for this destination."
          confirmLabel="Mark Failed"
          variant="destructive"
          onConfirm={handleFailed}
        />
      </div>
      </>
      )}
    </div>
  )
}
