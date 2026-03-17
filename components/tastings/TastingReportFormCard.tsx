'use client'

import { useEffect, useRef } from 'react'
import { submitTastingReport } from '@/actions/tastings'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useFormDraftAutosave } from '@/hooks/useFormDraftAutosave'
import { formatEasternTimeInput } from '@/lib/tastings/time'

type ReportRecord = {
  actualStartTime: string | null
  actualEndTime: string | null
  samplesServed: number | null
  bottlesSold: number | null
  casesSold: number | null
  consumerInteractions: number | null
  accountFeedback: string | null
  highlights: string | null
  issues: string | null
  followUpNeeded: boolean
  followUpNotes: string | null
  submittedAt: Date
} | null

export function TastingReportFormCard({
  tasting,
  report,
  success,
  error,
  compact = false,
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
}) {
  const reportFormRef = useRef<HTMLFormElement | null>(null)
  const reportDraft = useFormDraftAutosave(reportFormRef, `tasting-report:${tasting.id}`)

  useEffect(() => {
    if (success === 'report_submitted') reportDraft.clearDraft()
  }, [reportDraft, success])

  return (
    <Card id="report">
      <CardHeader>
        <CardTitle>{compact ? `Quick Report: ${tasting.eventName}` : 'Submit Tasting Report'}</CardTitle>
      </CardHeader>
      <CardContent>
        {success ? <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div> : null}
        {error ? <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
        <form ref={reportFormRef} action={submitTastingReport} className="space-y-4">
          <input type="hidden" name="tastingId" value={tasting.id} />
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
              <Label htmlFor="casesSold">Cases Sold</Label>
              <Input id="casesSold" name="casesSold" type="number" min="0" defaultValue={report?.casesSold ?? 0} />
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
