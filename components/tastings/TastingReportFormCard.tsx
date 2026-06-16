'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { submitTastingReport } from '@/actions/tastings'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useFormDraftAutosave } from '@/hooks/useFormDraftAutosave'
import { formatEasternTimeInput } from '@/lib/tastings/time'
import { Camera, Loader2, LayoutGrid } from 'lucide-react'
import { signedPhotoUrl } from '@/lib/gcs/photo-url'

type ReportRecord = {
  actualStartTime: string | null
  actualEndTime: string | null
  samplesServed: number | null
  bottlesSold: number | null
  missedCustomers: number | null
  consumerInteractions: number | null
  bottlePriceOnShelf: string | null
  bottlesInStock: number | null
  accountFeedback: string | null
  highlights: string | null
  issues: string | null
  followUpNeeded: boolean
  followUpNotes: string | null
  setupPhotoUrl: string | null
  shelfPhotoUrls: string[] | null
  submittedAt: Date
} | null

const MAX_SHELF_PHOTOS = 4

export function TastingReportFormCard({
  tasting,
  report,
  success,
  error,
  compact = false,
  redirectTo,
}: {
  tasting: {
    id: string
    eventName: string
    scheduledAt: Date
  }
  report: ReportRecord
  success?: string
  error?: string
  compact?: boolean
  redirectTo?: string
}) {
  const reportFormRef = useRef<HTMLFormElement | null>(null)
  const reportDraft = useFormDraftAutosave(reportFormRef, `tasting-report:${tasting.id}`)

  // Photo state
  const [setupPhotoUrl, setSetupPhotoUrl] = useState(report?.setupPhotoUrl ?? '')
  const [shelfPhotoUrls, setShelfPhotoUrls] = useState<string[]>(report?.shelfPhotoUrls ?? [])
  const [uploadingSetup, setUploadingSetup] = useState(false)
  const [uploadingShelf, setUploadingShelf] = useState<boolean[]>([false, false, false, false])

  useEffect(() => {
    if (success === 'Tasting report submitted.') reportDraft.clearDraft()
  }, [reportDraft, success])

  async function handleUploadSetup(file: File) {
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File too large', { description: 'Maximum 10MB.' })
      return
    }
    setUploadingSetup(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('folder', 'tastings')
      formData.append('filename', `setup-${file.name}`)
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      const payload = await res.json().catch(() => null)
      if (!res.ok) throw new Error(payload?.error || 'Upload failed')
      setSetupPhotoUrl(payload.publicUrl)
      toast.success('Setup photo uploaded')
    } catch (e) {
      toast.error('Upload failed', { description: e instanceof Error ? e.message : undefined })
    } finally {
      setUploadingSetup(false)
    }
  }

  async function handleUploadShelf(file: File, index: number) {
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File too large', { description: 'Maximum 10MB.' })
      return
    }
    setUploadingShelf(prev => { const next = [...prev]; next[index] = true; return next })
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('folder', 'tastings')
      formData.append('filename', `shelf-${index + 1}-${file.name}`)
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      const payload = await res.json().catch(() => null)
      if (!res.ok) throw new Error(payload?.error || 'Upload failed')
      setShelfPhotoUrls(prev => {
        const next = [...prev]
        next[index] = payload.publicUrl
        return next
      })
      toast.success(`Shelf photo ${index + 1} uploaded`)
    } catch (e) {
      toast.error('Upload failed', { description: e instanceof Error ? e.message : undefined })
    } finally {
      setUploadingShelf(prev => { const next = [...prev]; next[index] = false; return next })
    }
  }

  const shelfSlots = Array.from({ length: MAX_SHELF_PHOTOS }, (_, i) => i)

  return (
    <Card id="report">
      <CardHeader>
        <CardTitle>{compact ? `Quick Report: ${tasting.eventName}` : 'Submit Tasting Report'}</CardTitle>
      </CardHeader>
      <CardContent>
        {success ? <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div> : null}
        {error ? <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

        {/* Photo Upload Section */}
        <div className="mb-6 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Event Photos</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {/* Setup photo */}
            <label className="block cursor-pointer sm:col-span-1">
              <span className="mb-1 block truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Setup Photo</span>
              <span className="flex aspect-square w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-1.5 py-2 text-center transition-colors hover:border-violet-400 hover:bg-violet-50">
                {uploadingSetup
                  ? <Loader2 className="mb-1 h-5 w-5 animate-spin text-slate-500" />
                  : <Camera className="mb-1 h-5 w-5 text-slate-400" />
                }
                <span className="text-[11px] font-semibold leading-tight text-slate-900">
                  {setupPhotoUrl ? 'Replace' : 'Upload'}
                </span>
                <span className="mt-0.5 text-[10px] leading-tight text-muted-foreground">Table setup</span>
                {setupPhotoUrl && (
                  <a href={signedPhotoUrl(setupPhotoUrl) ?? setupPhotoUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                    className="mt-1 text-[10px] font-medium text-violet-600 underline">Preview</a>
                )}
              </span>
              <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) void handleUploadSetup(f) }} />
            </label>

            {/* Shelf photos */}
            {shelfSlots.map(i => (
              <label key={i} className="block cursor-pointer">
                <span className="mb-1 block truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Shelf {i + 1}</span>
                <span className="flex aspect-square w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-1.5 py-2 text-center transition-colors hover:border-violet-400 hover:bg-violet-50">
                  {uploadingShelf[i]
                    ? <Loader2 className="mb-1 h-5 w-5 animate-spin text-slate-500" />
                    : <LayoutGrid className="mb-1 h-5 w-5 text-slate-400" />
                  }
                  <span className="text-[11px] font-semibold leading-tight text-slate-900">
                    {shelfPhotoUrls[i] ? 'Replace' : 'Upload'}
                  </span>
                  <span className="mt-0.5 text-[10px] leading-tight text-muted-foreground">Shelf photo</span>
                  {shelfPhotoUrls[i] && (
                    <a href={signedPhotoUrl(shelfPhotoUrls[i]) ?? shelfPhotoUrls[i]} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                      className="mt-1 text-[10px] font-medium text-violet-600 underline">Preview</a>
                  )}
                </span>
                <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) void handleUploadShelf(f, i) }} />
              </label>
            ))}
          </div>
        </div>

        <form ref={reportFormRef} action={submitTastingReport} className="space-y-4">
          <input type="hidden" name="tastingId" value={tasting.id} />
          {redirectTo && <input type="hidden" name="redirectTo" value={redirectTo} />}
          {/* Photo URL hidden inputs — kept in sync with state */}
          <input type="hidden" name="setupPhotoUrl" value={setupPhotoUrl} />
          <input type="hidden" name="shelfPhotoUrls" value={JSON.stringify(shelfPhotoUrls.filter(Boolean))} />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="actualStartTime">Actual Start Time</Label>
              <Input id="actualStartTime" name="actualStartTime" type="time" defaultValue={report?.actualStartTime ?? formatEasternTimeInput(tasting.scheduledAt)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="actualEndTime">Actual End Time</Label>
              <Input id="actualEndTime" name="actualEndTime" type="time" defaultValue={report?.actualEndTime ?? ''} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="samplesServed">Samples Served</Label>
              <Input id="samplesServed" name="samplesServed" type="number" min="0" defaultValue={report?.samplesServed ?? 0} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="consumerInteractions">Consumer Interactions</Label>
              <Input id="consumerInteractions" name="consumerInteractions" type="number" min="0" defaultValue={report?.consumerInteractions ?? 0} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="bottlesSold">Bottles Sold</Label>
              <Input id="bottlesSold" name="bottlesSold" type="number" min="0" defaultValue={report?.bottlesSold ?? 0} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="missedCustomers">Customers Missed</Label>
              <Input id="missedCustomers" name="missedCustomers" type="number" min="0" defaultValue={report?.missedCustomers ?? 0} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="bottlePriceOnShelf">Bottle Price On Shelf</Label>
              <Input
                id="bottlePriceOnShelf"
                name="bottlePriceOnShelf"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                defaultValue={report?.bottlePriceOnShelf ?? ''}
                placeholder="24.99"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bottlesInStock">Number Of Bottles In Stock</Label>
              <Input id="bottlesInStock" name="bottlesInStock" type="number" min="0" defaultValue={report?.bottlesInStock ?? ''} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="accountFeedback">Store Feedback</Label>
            <textarea id="accountFeedback" name="accountFeedback" className="min-h-24 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" defaultValue={report?.accountFeedback ?? ''} placeholder="What did the store team say? Any requests or notable comments?" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="highlights">What Went Well</Label>
            <textarea id="highlights" name="highlights" className="min-h-24 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" defaultValue={report?.highlights ?? ''} placeholder="Quick summary of the tasting, top moments, and what moved product." />
          </div>
          <div className="space-y-2">
            <Label htmlFor="issues">Issues Or Constraints</Label>
            <textarea id="issues" name="issues" className="min-h-24 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" defaultValue={report?.issues ?? ''} placeholder="Any supply issues, staffing issues, or problems during the event." />
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input type="checkbox" name="followUpNeeded" defaultChecked={report?.followUpNeeded ?? false} className="rounded" />
              Follow-up needed from staff
            </label>
          </div>
          <div className="space-y-2">
            <Label htmlFor="followUpNotes">Follow-up Notes</Label>
            <textarea id="followUpNotes" name="followUpNotes" className="min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" defaultValue={report?.followUpNotes ?? ''} placeholder="List anything staff needs to action after this tasting." />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
            <span className="text-slate-500">{reportDraft.statusText || 'Report draft saves locally while you type.'}</span>
            <span className="text-slate-500">{report ? 'Saved report exists' : 'Draft mode'}</span>
          </div>

          <Button type="submit" className="w-full">{report ? 'Update Report' : 'Submit Report'}</Button>
        </form>
      </CardContent>
    </Card>
  )
}
